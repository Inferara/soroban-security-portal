using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using AutoMapper;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Logging;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;
using SorobanSecurityPortalApi.Services.Moderation;

namespace SorobanSecurityPortalApi.Services.ControllersServices
{
    public interface ICommentService
    {
        Task<List<CommentViewModel>> GetComments(EntityType entityType, int entityId, int page, int pageSize = 20);
        Task<int> GetCount(EntityType entityType, int entityId);
        Task<CommentViewModel> AddComment(CreateCommentRequest request);
        Task DeleteComment(int id);
        Task<CommentViewModel> UpdateComment(int id, string content);
        Task<List<CommentEditHistoryEntry>> GetEditHistory(int id);
    }

    public class CommentService : ICommentService
    {
        private readonly ICommentProcessor _processor;
        private readonly IContentFilterService _contentFilter;
        private readonly IUserContextAccessor _userContext;
        private readonly IMapper _mapper;
        private readonly IDistributedCache _cache;
        private readonly IVoteProcessor _voteProcessor;
        private readonly IMentionProcessor _mentionProcessor;
        private readonly INotificationService _notificationService;
        private readonly ILogger<CommentService> _logger;

        public CommentService(
            ICommentProcessor processor, IContentFilterService contentFilter,
            IUserContextAccessor userContext, IMapper mapper, IDistributedCache cache,
            IVoteProcessor voteProcessor, IMentionProcessor mentionProcessor,
            INotificationService notificationService, ILogger<CommentService> logger)
        {
            _processor = processor;
            _contentFilter = contentFilter;
            _userContext = userContext;
            _mapper = mapper;
            _cache = cache;
            _voteProcessor = voteProcessor;
            _mentionProcessor = mentionProcessor;
            _notificationService = notificationService;
            _logger = logger;
        }

        public async Task<List<CommentViewModel>> GetComments(EntityType entityType, int entityId, int page, int pageSize = 20)
        {
            page = Math.Max(1, page);
            pageSize = Math.Max(1, Math.Min(100, pageSize));

            var top = await _processor.ListByEntity(entityType, entityId, page, pageSize, includeSuppressed: false);
            var topIds = top.Select(c => c.Id).ToList();
            var replies = await _processor.ListReplies(entityType, entityId, topIds);

            var names = await _processor.GetAuthorNames(
                top.Select(c => c.AuthorId).Concat(replies.Select(r => r.AuthorId)).Distinct().ToList());

            CommentViewModel ToVm(CommentModel c)
            {
                var vm = _mapper.Map<CommentViewModel>(c);
                vm.AuthorName = names.TryGetValue(c.AuthorId, out var n) && !string.IsNullOrWhiteSpace(n) ? n : "Anonymous";
                return vm;
            }

            var repliesByParent = replies.GroupBy(r => r.ParentCommentId!.Value)
                .ToDictionary(g => g.Key, g => g.Select(ToVm).ToList());

            var result = new List<CommentViewModel>(top.Count);
            foreach (var c in top)
            {
                var vm = ToVm(c);
                if (repliesByParent.TryGetValue(c.Id, out var rs))
                {
                    vm.Replies = rs;
                    vm.ReplyCount = rs.Count;
                }
                result.Add(vm);
            }

            // Surface the requesting user's own vote + IsOwn flag on each comment (anonymous → skipped).
            var viewerId = await _userContext.GetLoginIdAsync();
            if (viewerId != 0)
            {
                var allIds = result.Select(c => c.Id).Concat(result.SelectMany(c => c.Replies).Select(r => r.Id)).ToList();
                var myVotes = await _voteProcessor.GetUserVotesForComments(viewerId, allIds);
                void Apply(CommentViewModel c)
                {
                    c.IsOwn = c.AuthorId == viewerId;
                    if (myVotes.TryGetValue(c.Id, out var vt)) c.CurrentUserVote = VoteService.ToStr(vt);
                }
                foreach (var c in result) { Apply(c); foreach (var r in c.Replies) Apply(r); }
            }
            return result;
        }

        public async Task<int> GetCount(EntityType entityType, int entityId)
        {
            var key = CommentCacheKeys.Count(entityType, entityId);
            var cached = await _cache.GetStringAsync(key);
            if (!string.IsNullOrEmpty(cached) && int.TryParse(cached, out var n)) return n;

            var count = await _processor.CountByEntity(entityType, entityId);
            await _cache.SetStringAsync(key, count.ToString(),
                new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(10) });
            return count;
        }

        public async Task<CommentViewModel> AddComment(CreateCommentRequest request)
        {
            var userId = await _userContext.GetLoginIdAsync();
            if (userId == 0) throw new UnauthorizedAccessException("User not logged in.");

            if (!await _processor.EntityExists(request.EntityType, request.EntityId))
                throw new KeyNotFoundException($"{request.EntityType} with id {request.EntityId} not found.");

            if (!await _contentFilter.CheckRateLimitAsync(userId))
                throw new InvalidOperationException("Rate limit exceeded. Please wait a moment before submitting again.");

            var filterResult = await _contentFilter.FilterContentAsync(request.Content, userId);
            if (filterResult.IsBlocked)
                throw new InvalidOperationException($"Comment blocked: {string.Join("; ", filterResult.Warnings)}");

            // Single-level threading: a reply always attaches to a TOP-LEVEL comment.
            // Replying to a reply re-parents to that reply's own top-level ancestor.
            int? parentId = null;
            int? repliedToAuthorId = null;
            if (request.ParentCommentId.HasValue)
            {
                var parent = await _processor.Get(request.ParentCommentId.Value);
                if (parent == null || parent.IsDeleted
                    || parent.EntityType != request.EntityType || parent.EntityId != request.EntityId)
                    throw new KeyNotFoundException($"Parent comment {request.ParentCommentId} not found on this entity.");
                parentId = parent.ParentCommentId ?? parent.Id;
                repliedToAuthorId = parent.AuthorId;   // notify the comment actually replied to
            }

            var comment = new CommentModel
            {
                AuthorId = userId,
                EntityType = request.EntityType,
                EntityId = request.EntityId,
                ParentCommentId = parentId,
                Content = request.Content,
                ContentHtml = filterResult.SanitizedContent ?? string.Empty,
                CreatedAt = DateTime.UtcNow
            };
            var saved = await _processor.Add(comment);
            await RunCommentSideEffects(saved, repliedToAuthorId, request.Content, notify: true);
            await InvalidateCount(request.EntityType, request.EntityId);

            var names = await _processor.GetAuthorNames(new List<int> { userId });
            var vm = _mapper.Map<CommentViewModel>(saved);
            vm.AuthorName = names.TryGetValue(userId, out var nm) && !string.IsNullOrWhiteSpace(nm) ? nm : "Anonymous";
            return vm;
        }

        public async Task DeleteComment(int id)
        {
            var userId = await _userContext.GetLoginIdAsync();
            if (userId == 0) throw new UnauthorizedAccessException("User not logged in.");
            var comment = await _processor.Get(id);
            if (comment == null) throw new KeyNotFoundException($"Comment with id {id} not found.");

            if (comment.AuthorId != userId && !await _userContext.IsLoginIdAdmin(userId))
                throw new UnauthorizedAccessException("You can only delete your own comments.");

            await _processor.SoftDelete(id);
            await InvalidateCount(comment.EntityType, comment.EntityId);
        }

        private Task InvalidateCount(EntityType type, int id) => _cache.RemoveAsync(CommentCacheKeys.Count(type, id));

        private const int EditWindowMinutes = 30;

        public async Task<CommentViewModel> UpdateComment(int id, string content)
        {
            var userId = await _userContext.GetLoginIdAsync();
            if (userId == 0) throw new UnauthorizedAccessException("User not logged in.");

            var comment = await _processor.Get(id);
            if (comment == null) throw new KeyNotFoundException($"Comment with id {id} not found.");
            // A hidden/soft-deleted comment is not editable (treat as not-found).
            if (comment.IsHidden || comment.IsDeleted)
                throw new KeyNotFoundException($"Comment with id {id} not found.");
            if (comment.AuthorId != userId)
                throw new UnauthorizedAccessException("You can only edit your own comments.");
            if ((DateTime.UtcNow - comment.CreatedAt).TotalMinutes > EditWindowMinutes)
                throw new InvalidOperationException("The edit window for this comment has expired.");

            if (!await _contentFilter.CheckRateLimitAsync(userId))
                throw new InvalidOperationException("Rate limit exceeded. Please wait a moment before submitting again.");
            var filterResult = await _contentFilter.FilterContentAsync(content, userId);
            if (filterResult.IsBlocked)
                throw new InvalidOperationException($"Comment blocked: {string.Join("; ", filterResult.Warnings)}");

            var history = ParseHistory(comment.EditHistory);
            // Capture the raw Markdown (not ContentHtml) so the trail stays diffable.
            history.Add(new CommentEditHistoryEntry { EditedAt = DateTime.UtcNow, PreviousContent = comment.Content });

            var updated = await _processor.UpdateContent(
                id, content, filterResult.SanitizedContent ?? string.Empty, JsonSerializer.Serialize(history));
            if (updated == null) throw new KeyNotFoundException($"Comment with id {id} not found.");
            await RunCommentSideEffects(updated, repliedToAuthorId: null, content, notify: false);

            var names = await _processor.GetAuthorNames(new List<int> { userId });
            var vm = _mapper.Map<CommentViewModel>(updated);
            vm.AuthorName = names.TryGetValue(userId, out var nm) && !string.IsNullOrWhiteSpace(nm) ? nm : "Anonymous";
            return vm;
        }

        public async Task<List<CommentEditHistoryEntry>> GetEditHistory(int id)
        {
            var comment = await _processor.Get(id);
            if (comment == null) throw new KeyNotFoundException($"Comment with id {id} not found.");
            return ParseHistory(comment.EditHistory);
        }

        // Mention indexing + notification creation are best-effort: the comment has already been
        // persisted, so a failure here must NOT fail the request or trigger a duplicate retry.
        private async Task RunCommentSideEffects(CommentModel comment, int? repliedToAuthorId, string rawContent, bool notify)
        {
            try
            {
                var mentionedIds = await _mentionProcessor.ReplaceCommentMentions(comment.Id, rawContent);
                if (notify)
                    await _notificationService.NotifyForNewComment(
                        comment.AuthorId, repliedToAuthorId, mentionedIds,
                        comment.Id, comment.EntityType, comment.EntityId, rawContent);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Comment side-effects (mentions/notifications) failed for comment {CommentId}", comment.Id);
            }
        }

        private static List<CommentEditHistoryEntry> ParseHistory(string? json)
            => JsonSerializer.Deserialize<List<CommentEditHistoryEntry>>(
                   string.IsNullOrWhiteSpace(json) ? "[]" : json) ?? new List<CommentEditHistoryEntry>();
    }
}

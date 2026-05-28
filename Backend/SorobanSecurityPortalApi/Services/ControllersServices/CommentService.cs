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
        // Maximum thread depth (top-level comment = level 1).
        private const int MaxCommentDepth = 5;

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

            // Fetch the reply subtrees breadth-first, one level at a time, down to MaxCommentDepth.
            // (top-level = level 1, so we fetch up to MaxCommentDepth-1 further levels.) A "seen" set
            // guards against pathological cycles and stops the walk once a level yields nothing new.
            var replyModels = new List<CommentModel>();
            var seen = new HashSet<int>(top.Select(c => c.Id));
            var frontier = top.Select(c => c.Id).ToList();
            for (var level = 1; level < MaxCommentDepth && frontier.Count > 0; level++)
            {
                var rs = await _processor.ListReplies(entityType, entityId, frontier) ?? new List<CommentModel>();
                var next = new List<int>();
                foreach (var r in rs)
                {
                    if (!r.ParentCommentId.HasValue || !seen.Add(r.Id)) continue;
                    replyModels.Add(r);
                    next.Add(r.Id);
                }
                frontier = next;
            }

            var names = await _processor.GetAuthorNames(
                top.Select(c => c.AuthorId).Concat(replyModels.Select(r => r.AuthorId)).Distinct().ToList());

            CommentViewModel ToVm(CommentModel c)
            {
                var vm = _mapper.Map<CommentViewModel>(c);
                vm.AuthorName = names.TryGetValue(c.AuthorId, out var n) && !string.IsNullOrWhiteSpace(n) ? n : "Anonymous";
                vm.Replies = new List<CommentViewModel>();
                return vm;
            }

            var byId = new Dictionary<int, CommentViewModel>();
            var result = new List<CommentViewModel>(top.Count);
            foreach (var c in top)
            {
                var vm = ToVm(c);
                byId[c.Id] = vm;
                result.Add(vm);
            }
            // replyModels are in BFS order, so each parent VM already exists when its child is attached.
            foreach (var r in replyModels)
            {
                var vm = ToVm(r);
                byId[r.Id] = vm;
                if (byId.TryGetValue(r.ParentCommentId!.Value, out var parentVm))
                    parentVm.Replies.Add(vm);
            }
            foreach (var vm in byId.Values) vm.ReplyCount = vm.Replies.Count;

            // Surface the requesting user's own vote + IsOwn flag on each comment (anonymous → skipped).
            var viewerId = await _userContext.GetLoginIdOrNullAsync() ?? 0;
            if (viewerId != 0)
            {
                var myVotes = await _voteProcessor.GetUserVotesForComments(viewerId, byId.Keys.ToList());
                foreach (var vm in byId.Values)
                {
                    vm.IsOwn = vm.AuthorId == viewerId;
                    if (myVotes.TryGetValue(vm.Id, out var vt)) vm.CurrentUserVote = VoteService.ToStr(vt);
                }
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

            // Threaded comments up to MaxCommentDepth levels. A reply attaches to the actual
            // comment it answers; once the chain reaches the max depth, further replies are rejected.
            int? parentId = null;
            int? repliedToAuthorId = null;
            if (request.ParentCommentId.HasValue)
            {
                var parent = await _processor.Get(request.ParentCommentId.Value);
                if (parent == null || parent.IsDeleted
                    || parent.EntityType != request.EntityType || parent.EntityId != request.EntityId)
                    throw new KeyNotFoundException($"Parent comment {request.ParentCommentId} not found on this entity.");

                // Walk up the ancestor chain to find the parent's depth (1-based). The walk is
                // bounded by MaxCommentDepth, so it costs at most a handful of lookups.
                var parentDepth = 1;
                var ancestorParentId = parent.ParentCommentId;
                while (ancestorParentId.HasValue && parentDepth < MaxCommentDepth)
                {
                    var ancestor = await _processor.Get(ancestorParentId.Value);
                    if (ancestor == null) break;
                    parentDepth++;
                    ancestorParentId = ancestor.ParentCommentId;
                }
                if (parentDepth >= MaxCommentDepth)
                    throw new InvalidOperationException($"Maximum comment depth of {MaxCommentDepth} levels reached.");

                parentId = parent.Id;
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

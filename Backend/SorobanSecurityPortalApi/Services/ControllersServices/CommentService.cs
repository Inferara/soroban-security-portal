using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using AutoMapper;
using Microsoft.Extensions.Caching.Distributed;
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
    }

    public class CommentService : ICommentService
    {
        private readonly ICommentProcessor _processor;
        private readonly IContentFilterService _contentFilter;
        private readonly IUserContextAccessor _userContext;
        private readonly IMapper _mapper;
        private readonly IDistributedCache _cache;

        public CommentService(
            ICommentProcessor processor, IContentFilterService contentFilter,
            IUserContextAccessor userContext, IMapper mapper, IDistributedCache cache)
        {
            _processor = processor;
            _contentFilter = contentFilter;
            _userContext = userContext;
            _mapper = mapper;
            _cache = cache;
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
            if (request.ParentCommentId.HasValue)
            {
                var parent = await _processor.Get(request.ParentCommentId.Value);
                if (parent == null || parent.IsDeleted
                    || parent.EntityType != request.EntityType || parent.EntityId != request.EntityId)
                    throw new KeyNotFoundException($"Parent comment {request.ParentCommentId} not found on this entity.");
                parentId = parent.ParentCommentId ?? parent.Id;
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
    }
}

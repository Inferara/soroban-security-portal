using AutoMapper;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace SorobanSecurityPortalApi.Services.ControllersServices
{
    public class CommentService : ICommentService
    {
        private readonly ICommentProcessor _commentProcessor;
        private readonly IMapper _mapper;
        private readonly IContentFilterService _contentFilterService;

        public CommentService(ICommentProcessor commentProcessor, IMapper mapper, IContentFilterService contentFilterService)
        {
            _commentProcessor = commentProcessor;
            _mapper = mapper;
            _contentFilterService = contentFilterService;
        }

        public async Task<List<CommentViewModel>> GetComments(CommentEntityType entityType, int entityId, int page, int pageSize, int? currentUserId)
        {
            var comments = await _commentProcessor.GetComments(entityType, entityId, page, pageSize);
            var viewModels = _mapper.Map<List<CommentViewModel>>(comments);

            if (currentUserId.HasValue)
            {
                foreach (var vm in viewModels)
                {
                    await SetUserVote(vm, currentUserId.Value);
                    foreach (var reply in vm.Replies)
                    {
                        await SetUserVote(reply, currentUserId.Value);
                    }
                }
            }

            return viewModels;
        }

        public async Task<int> GetCommentsTotal(CommentEntityType entityType, int entityId)
        {
            return await _commentProcessor.GetCommentsCount(entityType, entityId);
        }

        private async Task SetUserVote(CommentViewModel vm, int userId)
        {
            var vote = await _commentProcessor.GetUserVote(vm.Id, userId);
            vm.CurrentUserVote = vote switch
            {
                VoteType.Upvote => "upvote",
                VoteType.Downvote => "downvote",
                _ => "none"
            };
        }

        public async Task<CommentViewModel> AddComment(CommentCreateViewModel model, int userId)
        {
            var filterResult = await _contentFilterService.FilterContentAsync(model.Content, userId);
            if (filterResult.IsBlocked)
                throw new InvalidOperationException($"Content blocked: {string.Join(", ", filterResult.Warnings)}");

            var comment = _mapper.Map<CommentModel>(model);
            comment.AuthorId = userId;
            comment.ContentHtml = filterResult.SanitizedContent ?? string.Empty;

            var created = await _commentProcessor.AddComment(comment);
            return _mapper.Map<CommentViewModel>(created);
        }

        public async Task<CommentViewModel> UpdateComment(int id, CommentUpdateViewModel model, int userId)
        {
            var comment = await _commentProcessor.GetComment(id);
            if (comment == null) throw new KeyNotFoundException("Comment not found");
            if (comment.AuthorId != userId) throw new UnauthorizedAccessException("Not the owner");
            
            // Check time limit (e.g., 1 hour)
            if (DateTime.UtcNow - comment.CreatedAt > TimeSpan.FromHours(1))
                throw new InvalidOperationException("Edit time limit exceeded");

            var filterResult = await _contentFilterService.FilterContentAsync(model.Content, userId);
            if (filterResult.IsBlocked)
                throw new InvalidOperationException($"Content blocked: {string.Join(", ", filterResult.Warnings)}");

            _mapper.Map(model, comment);
            comment.ContentHtml = filterResult.SanitizedContent ?? string.Empty;
            comment.IsEdited = true;
            comment.UpdatedAt = DateTime.UtcNow;
            
            await _commentProcessor.UpdateComment(comment);
            return _mapper.Map<CommentViewModel>(comment);
        }

        public async Task DeleteComment(int id, int userId, bool isAdmin)
        {
            var comment = await _commentProcessor.GetComment(id);
            if (comment == null) return;

            if (comment.AuthorId != userId && !isAdmin)
                throw new UnauthorizedAccessException("Not the owner or admin");

            comment.IsDeleted = true;
            await _commentProcessor.UpdateComment(comment);
        }

        public async Task Vote(int id, VoteType vote, int userId)
        {
            await _commentProcessor.Vote(id, userId, vote);
        }
    }

    public interface ICommentService
    {
        Task<List<CommentViewModel>> GetComments(CommentEntityType entityType, int entityId, int page, int pageSize, int? currentUserId);
        Task<int> GetCommentsTotal(CommentEntityType entityType, int entityId);
        Task<CommentViewModel> AddComment(CommentCreateViewModel model, int userId);
        Task<CommentViewModel> UpdateComment(int id, CommentUpdateViewModel model, int userId);
        Task DeleteComment(int id, int userId, bool isAdmin);
        Task Vote(int id, VoteType vote, int userId);
    }
}

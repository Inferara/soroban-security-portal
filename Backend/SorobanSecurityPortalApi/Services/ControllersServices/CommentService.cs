using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;
using Microsoft.AspNetCore.Http;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using AutoMapper;
using SorobanSecurityPortalApi.Common;

namespace SorobanSecurityPortalApi.Services.ControllersServices
{
    public class CommentService
    {
        private readonly ICommentProcessor _commentProcessor;
        private readonly IMapper _mapper;
        private readonly IUserContextAccessor _userContextAccessor;

        public CommentService(ICommentProcessor commentProcessor, IMapper mapper, IUserContextAccessor userContextAccessor)
        {
            _commentProcessor = commentProcessor;
            _mapper = mapper;
            _userContextAccessor = userContextAccessor;
        }

        public async Task<List<CommentViewModel>> GetComments(CommentEntityType entityType, int entityId, int page, int pageSize)
        {
            var comments = await _commentProcessor.GetComments(entityType, entityId, page, pageSize);
            var commentIds = comments.SelectMany(c => c.Replies.Select(r => r.Id)).Concat(comments.Select(c => c.Id)).ToList();
            var userVotes = await _commentProcessor.GetUserVotes(commentIds, _userContextAccessor.UserId);

            var viewModels = _mapper.Map<List<CommentViewModel>>(comments);
            foreach (var vm in viewModels)
            {
                if (userVotes.TryGetValue(vm.Id, out var vote))
                {
                    vm.CurrentUserVote = vote.ToString().ToLower();
                }
                foreach (var reply in vm.Replies)
                {
                    if (userVotes.TryGetValue(reply.Id, out var replyVote))
                    {
                        reply.CurrentUserVote = replyVote.ToString().ToLower();
                    }
                }
            }
            return viewModels;
        }

        public async Task<CommentViewModel?> GetComment(int id)
        {
            var comment = await _commentProcessor.GetComment(id);
            if (comment == null) return null;

            var userVotes = await _commentProcessor.GetUserVotes(new List<int> { id }, _userContextAccessor.UserId);
            var viewModel = _mapper.Map<CommentViewModel>(comment);
            if (userVotes.TryGetValue(id, out var vote))
            {
                viewModel.CurrentUserVote = vote.ToString().ToLower();
            }
            return viewModel;
        }

        public async Task<CommentViewModel> CreateComment(CommentCreateViewModel model)
        {
            var comment = _mapper.Map<CommentModel>(model);
            comment.AuthorId = _userContextAccessor.UserId;
            // TODO: Process content to HTML if needed
            comment.ContentHtml = comment.Content; // Placeholder

            var created = await _commentProcessor.AddComment(comment);
            return await GetComment(created.Id) ?? throw new Exception("Failed to retrieve created comment");
        }

        public async Task UpdateComment(int id, CommentUpdateViewModel model)
        {
            var existing = await _commentProcessor.GetComment(id);
            if (existing == null || existing.AuthorId != _userContextAccessor.UserId)
            {
                throw new UnauthorizedAccessException("Comment not found or access denied");
            }

            var updateModel = _mapper.Map<CommentModel>(model);
            updateModel.Id = id;
            updateModel.UpdatedAt = DateTime.UtcNow;
            updateModel.IsEdited = true;

            await _commentProcessor.UpdateComment(updateModel);
        }

        public async Task DeleteComment(int id)
        {
            var existing = await _commentProcessor.GetComment(id);
            if (existing == null || existing.AuthorId != _userContextAccessor.UserId)
            {
                throw new UnauthorizedAccessException("Comment not found or access denied");
            }

            // Soft delete by updating
            var updateModel = new CommentModel { Id = id, IsDeleted = true };
            await _commentProcessor.UpdateComment(updateModel);
        }

        public async Task Vote(int commentId, VoteType voteType)
        {
            await _commentProcessor.Vote(commentId, _userContextAccessor.UserId, voteType);
        }

        public async Task<int> GetCommentsCount(CommentEntityType entityType, int entityId)
        {
            return await _commentProcessor.GetCommentsCount(entityType, entityId);
        }
    }
}
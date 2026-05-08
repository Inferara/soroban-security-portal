using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using AutoMapper;
using SorobanSecurityPortalApi.Common;

namespace SorobanSecurityPortalApi.Services.ControllersServices
{
    public interface ICommentService
    {
        Task<List<CommentViewModel>> GetComments(CommentEntityType entityType, int entityId, int page, int pageSize);
        Task<CommentViewModel?> GetComment(int id);
        Task<CommentViewModel> CreateComment(CommentCreateViewModel model);
        Task UpdateComment(int id, CommentUpdateViewModel model);
        Task DeleteComment(int id);
        Task Vote(int commentId, VoteRequest request);
        Task<int> GetCommentsCount(CommentEntityType entityType, int entityId);
    }

    public class CommentService : ICommentService
    {
        private readonly ICommentProcessor _commentProcessor;
        private readonly IMapper _mapper;
        private readonly IUserContextAccessor _userContextAccessor;
        private readonly IContentFilterService _contentFilterService;
        private readonly IExtendedConfig _config;

        public CommentService(
            ICommentProcessor commentProcessor,
            IMapper mapper,
            IUserContextAccessor userContextAccessor,
            IContentFilterService contentFilterService,
            IExtendedConfig config)
        {
            _commentProcessor = commentProcessor;
            _mapper = mapper;
            _userContextAccessor = userContextAccessor;
            _contentFilterService = contentFilterService;
            _config = config;
        }

        public async Task<List<CommentViewModel>> GetComments(CommentEntityType entityType, int entityId, int page, int pageSize)
        {
            var loginId = await _userContextAccessor.GetLoginIdAsync();
            var comments = await _commentProcessor.GetComments(entityType, entityId, page, pageSize);
            var commentIds = comments.SelectMany(c => c.Replies.Select(r => r.Id)).Concat(comments.Select(c => c.Id)).ToList();
            var userVotes = await _commentProcessor.GetUserVotes(commentIds, loginId);

            var viewModels = _mapper.Map<List<CommentViewModel>>(comments);
            foreach (var vm in viewModels)
            {
                if (userVotes.TryGetValue(vm.Id, out var vote))
                {
                    vm.CurrentUserVote = vote.ToString().ToLowerInvariant();
                }
                foreach (var reply in vm.Replies)
                {
                    if (userVotes.TryGetValue(reply.Id, out var replyVote))
                    {
                        reply.CurrentUserVote = replyVote.ToString().ToLowerInvariant();
                    }
                }
            }
            return viewModels;
        }

        public async Task<CommentViewModel?> GetComment(int id)
        {
            var comment = await _commentProcessor.GetComment(id);
            if (comment == null) return null;

            var loginId = await _userContextAccessor.GetLoginIdAsync();
            var userVotes = await _commentProcessor.GetUserVotes(new List<int> { id }, loginId);
            var viewModel = _mapper.Map<CommentViewModel>(comment);
            if (userVotes.TryGetValue(id, out var vote))
            {
                viewModel.CurrentUserVote = vote.ToString().ToLowerInvariant();
            }
            return viewModel;
        }

        public async Task<CommentViewModel> CreateComment(CommentCreateViewModel model)
        {
            var loginId = await _userContextAccessor.GetLoginIdAsync();

            // Filter content
            var filterResult = await _contentFilterService.FilterContentAsync(model.Content, loginId);
            if (filterResult.IsBlocked)
            {
                throw new InvalidOperationException($"Content blocked: {string.Join(", ", filterResult.Warnings)}");
            }

            var comment = _mapper.Map<CommentModel>(model);
            comment.AuthorId = loginId;
            comment.Content = model.Content; // Keep original markdown
            comment.ContentHtml = filterResult.SanitizedContent; // Store sanitized HTML

            var created = await _commentProcessor.AddComment(comment);
            return await GetComment(created.Id) ?? throw new Exception("Failed to retrieve created comment");
        }

        public async Task UpdateComment(int id, CommentUpdateViewModel model)
        {
            var loginId = await _userContextAccessor.GetLoginIdAsync();
            var existing = await _commentProcessor.GetComment(id);
            if (existing == null)
            {
                throw new KeyNotFoundException("Comment not found");
            }

            if (existing.AuthorId != loginId)
            {
                throw new UnauthorizedAccessException("User is not the owner of this comment");
            }

            // Check edit window
            if (_config.CommentEditWindowMinutes > 0)
            {
                var timeSinceCreation = DateTime.UtcNow - existing.CreatedAt;
                if (timeSinceCreation.TotalMinutes > _config.CommentEditWindowMinutes)
                {
                    throw new InvalidOperationException($"Comment edit window has expired. Edits are allowed only within {_config.CommentEditWindowMinutes} minutes of creation.");
                }
            }

            // Filter content
            var filterResult = await _contentFilterService.FilterContentAsync(model.Content, loginId);
            if (filterResult.IsBlocked)
            {
                throw new InvalidOperationException($"Content blocked: {string.Join(", ", filterResult.Warnings)}");
            }

            var updateModel = _mapper.Map<CommentModel>(model);
            updateModel.Id = id;
            updateModel.Content = model.Content; // Keep original markdown
            updateModel.ContentHtml = filterResult.SanitizedContent; // Update sanitized HTML
            updateModel.UpdatedAt = DateTime.UtcNow;
            updateModel.IsEdited = true;

            await _commentProcessor.UpdateComment(updateModel);
        }

        public async Task DeleteComment(int id)
        {
            var loginId = await _userContextAccessor.GetLoginIdAsync();
            var existing = await _commentProcessor.GetComment(id);
            if (existing == null)
            {
                throw new KeyNotFoundException("Comment not found");
            }

            if (existing.AuthorId != loginId)
            {
                throw new UnauthorizedAccessException("User is not the owner of this comment");
            }

            await _commentProcessor.SoftDeleteComment(id);
        }

        public async Task Vote(int commentId, VoteRequest request)
        {
            if (request == null)
            {
                throw new ArgumentNullException(nameof(request), "Request body cannot be null.");
            }

            if (!Enum.TryParse<VoteType>(request.Vote, true, out var voteType))
            {
                throw new ArgumentException("Invalid vote type");
            }

            var loginId = await _userContextAccessor.GetLoginIdAsync();
            await _commentProcessor.Vote(commentId, loginId, voteType);
        }

        public async Task<int> GetCommentsCount(CommentEntityType entityType, int entityId)
        {
            return await _commentProcessor.GetCommentsCount(entityType, entityId);
        }
    }

    public class VoteRequest
    {
        public string Vote { get; set; } = string.Empty; // "upvote", "downvote", "none"
    }
}
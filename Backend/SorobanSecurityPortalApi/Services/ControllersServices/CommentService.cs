using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;

namespace SorobanSecurityPortalApi.Services.ControllersServices
{
    public class CommentService : ICommentService
    {
        private readonly ICommentProcessor _commentProcessor;
        private readonly IActivityProcessor _activityProcessor;
        private readonly UserContextAccessor _userContextAccessor;

        public CommentService(
            ICommentProcessor commentProcessor,
            IActivityProcessor activityProcessor,
            UserContextAccessor userContextAccessor)
        {
            _commentProcessor = commentProcessor;
            _activityProcessor = activityProcessor;
            _userContextAccessor = userContextAccessor;
        }

        public async Task<CommentViewModel?> Add(CreateCommentViewModel commentViewModel)
        {
            var userId = await _userContextAccessor.GetLoginIdAsync();
            
            var comment = new CommentModel
            {
                Content = commentViewModel.Content,
                EntityType = commentViewModel.EntityType,
                EntityId = commentViewModel.EntityId,
                LoginId = userId
            };
            
            var commentId = await _commentProcessor.Add(comment);
            
            // Create activity
            await _activityProcessor.Add(new ActivityModel
            {
                Type = ActivityType.CommentCreated,
                EntityId = commentId,
                LoginId = userId,
                CreatedAt = DateTime.UtcNow
            });
            
            return await _commentProcessor.GetById(commentId);
        }

        public async Task<bool> Update(UpdateCommentViewModel commentViewModel)
        {
            var userId = await _userContextAccessor.GetLoginIdAsync();
            var comment = await _commentProcessor.GetById(commentViewModel.Id);
            
            if (comment == null || comment.LoginId != userId)
            {
                throw new UnauthorizedAccessException("You do not have permission to edit this comment.");
            }
            
            return await _commentProcessor.Update(commentViewModel);
        }

        public async Task<bool> Delete(int commentId)
        {
            var userId = await _userContextAccessor.GetLoginIdAsync();
            return await _commentProcessor.Delete(commentId, userId);
        }

        public async Task<List<CommentViewModel>> GetByEntity(CommentEntityType entityType, int entityId)
        {
            return await _commentProcessor.GetByEntity(entityType, entityId);
        }

        public async Task<CommentViewModel?> GetById(int commentId)
        {
            return await _commentProcessor.GetById(commentId);
        }
    }

    public interface ICommentService
    {
        Task<CommentViewModel?> Add(CreateCommentViewModel commentViewModel);
        Task<bool> Update(UpdateCommentViewModel commentViewModel);
        Task<bool> Delete(int commentId);
        Task<List<CommentViewModel>> GetByEntity(CommentEntityType entityType, int entityId);
        Task<CommentViewModel?> GetById(int commentId);
    }
}

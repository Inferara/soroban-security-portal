using SorobanSecurityPortalApi.Models.ViewModels;

namespace SorobanSecurityPortalApi.Services.ProcessingServices
{
    public interface ICommentService
    {
        Task<List<CommentViewModel>> GetThreadedComments(string entityType, int entityId);
        Task<CommentViewModel> PostComment(int authorId, string entityType, int entityId, string content, int? parentId = null);
        Task<bool> ToggleVote(int commentId, int userId, bool isUpvote);
        Task<bool> DeleteComment(int commentId, int userId);
    }
}
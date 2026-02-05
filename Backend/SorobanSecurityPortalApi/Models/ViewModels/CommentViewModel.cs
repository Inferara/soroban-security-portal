using SorobanSecurityPortalApi.Models.DbModels;

namespace SorobanSecurityPortalApi.Models.ViewModels
{
    public class CommentViewModel
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public string UserName { get; set; }
        public string UserAvatarUrl { get; set; } // Optional, if we want to display avatar
        public int ReferenceId { get; set; }
        public ReferenceType ReferenceType { get; set; }
        public string Content { get; set; }
        public List<CommentHistoryItem> History { get; set; } = new List<CommentHistoryItem>();
        public DateTime Created { get; set; }
        public DateTime? LastEdited { get; set; }
        public bool IsDeleted { get; set; }
        public bool IsEditable { get; set; }
        public bool IsOwner { get; set; } // Computed property for frontend convenience
    }

    public class CreateCommentRequest
    {
        public int ReferenceId { get; set; }
        public ReferenceType ReferenceType { get; set; }
        public string Content { get; set; }
    }

    public class UpdateCommentRequest
    {
        public string Content { get; set; }
    }
}

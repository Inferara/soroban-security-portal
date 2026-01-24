using SorobanSecurityPortalApi.Models.DbModels;

namespace SorobanSecurityPortalApi.Models.ViewModels
{
    public class CommentViewModel
    {
        public int Id { get; set; }
        public string Content { get; set; } = "";
        public int LoginId { get; set; }
        public string UserName { get; set; } = "";
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public CommentEntityType EntityType { get; set; }
        public int EntityId { get; set; }
        public bool IsDeleted { get; set; } = false;
    }

    public class CreateCommentViewModel
    {
        public string Content { get; set; } = "";
        public CommentEntityType EntityType { get; set; }
        public int EntityId { get; set; }
    }

    public class UpdateCommentViewModel
    {
        public int Id { get; set; }
        public string Content { get; set; } = "";
    }
}

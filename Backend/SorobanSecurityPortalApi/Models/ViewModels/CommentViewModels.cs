namespace SorobanSecurityPortalApi.Models.ViewModels
{
    public class CommentViewModel
    {
        public int Id { get; set; }
        public string AuthorName { get; set; } = string.Empty;
        public string? AuthorAvatarUrl { get; set; }
        public int AuthorId { get; set; }
        
        public string EntityType { get; set; } = string.Empty;
        public int EntityId { get; set; }
        
        public int? ParentCommentId { get; set; }
        public string Content { get; set; } = string.Empty;
        public string? ContentHtml { get; set; }
        
        public string Status { get; set; } = "Active";
        public int UpvoteCount { get; set; }
        public int DownvoteCount { get; set; }
        
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }

        public List<CommentViewModel> Replies { get; set; } = new();
        
        public List<MentionViewModel> Mentions { get; set; } = new();
    }

    public class MentionViewModel
    {
        public string MentionedUserName { get; set; } = string.Empty;
        public int MentionedUserId { get; set; }
        public int StartIndex { get; set; }
        public int Length { get; set; }
    }
}
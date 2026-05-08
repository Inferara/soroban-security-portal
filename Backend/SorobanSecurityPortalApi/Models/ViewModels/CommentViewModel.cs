using System;
using System.Collections.Generic;
using SorobanSecurityPortalApi.Models.DbModels;

namespace SorobanSecurityPortalApi.Models.ViewModels
{
    public class CommentViewModel
    {
        public int Id { get; set; }
        public string Content { get; set; } = string.Empty;
        public string ContentHtml { get; set; } = string.Empty;
        public CommentAuthorViewModel Author { get; set; } = new();
        public int UpvoteCount { get; set; }
        public int DownvoteCount { get; set; }
        public string CurrentUserVote { get; set; } = "none"; // "upvote", "downvote", "none"
        public DateTime CreatedAt { get; set; }
        public bool IsEdited { get; set; }
        public List<CommentViewModel> Replies { get; set; } = new();
        public int ReplyCount { get; set; }
    }

    public class CommentAuthorViewModel
    {
        public int Id { get; set; }
        public string DisplayName { get; set; } = string.Empty;
        public string AvatarUrl { get; set; } = string.Empty;
        public int ReputationScore { get; set; }
    }

    public class CommentCreateViewModel
    {
        public string Content { get; set; } = string.Empty;
        public CommentEntityType EntityType { get; set; }
        public int EntityId { get; set; }
        public int? ParentId { get; set; }
    }

    public class CommentUpdateViewModel
    {
        public string Content { get; set; } = string.Empty;
    }
}

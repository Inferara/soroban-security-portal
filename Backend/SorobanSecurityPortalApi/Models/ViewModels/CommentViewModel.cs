using System;
using System.Collections.Generic;
using SorobanSecurityPortalApi.Models.DbModels;

namespace SorobanSecurityPortalApi.Models.ViewModels
{
    // Public comment DTO. Exposes the author's display name + id (for the public
    // avatar endpoint) — never email or other PII. Replies are nested one level deep.
    public class CommentViewModel
    {
        public int Id { get; set; }
        public EntityType EntityType { get; set; }
        public int EntityId { get; set; }
        public int? ParentCommentId { get; set; }
        public string Content { get; set; } = string.Empty;
        public string ContentHtml { get; set; } = string.Empty;
        public int AuthorId { get; set; }
        public string AuthorName { get; set; } = string.Empty;
        public int UpvoteCount { get; set; }
        public int DownvoteCount { get; set; }
        public bool IsEdited { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public int ReplyCount { get; set; }
        public List<CommentViewModel> Replies { get; set; } = new();
        // "upvote" | "downvote" | null — the requesting user's current vote on this comment.
        public string? CurrentUserVote { get; set; }
    }

    public class CreateCommentRequest
    {
        public EntityType EntityType { get; set; }
        public int EntityId { get; set; }
        public int? ParentCommentId { get; set; }
        public string Content { get; set; } = string.Empty;
    }

    public class UpdateCommentRequest
    {
        public string Content { get; set; } = string.Empty;
    }

    public class VoteResultViewModel
    {
        public int UpvoteCount { get; set; }
        public int DownvoteCount { get; set; }
        public string? CurrentUserVote { get; set; }
    }

    public class VoteRequest
    {
        public string VoteType { get; set; } = string.Empty;
    }

    // One entry in a comment's edit trail (stored as a JSON array in comment.edit_history).
    public class CommentEditHistoryEntry
    {
        public DateTime EditedAt { get; set; }
        public string PreviousContent { get; set; } = string.Empty;
    }
}

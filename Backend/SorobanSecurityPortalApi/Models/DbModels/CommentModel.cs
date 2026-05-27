using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SorobanSecurityPortalApi.Models.DbModels
{
    [Table("comment")]
    public class CommentModel
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int AuthorId { get; set; }

        [Required]
        public EntityType EntityType { get; set; }

        [Required]
        public int EntityId { get; set; }

        // Null = top-level. Replies always point at a TOP-LEVEL comment (single-level threading).
        public int? ParentCommentId { get; set; }

        [Required]
        [MaxLength(10000)]
        public string Content { get; set; } = string.Empty;

        // Sanitized HTML produced by the content filter (populated when the API is added).
        [Required]
        public string ContentHtml { get; set; } = string.Empty;

        // Moderation suppression flags (mirror RatingModel). Hidden or soft-deleted
        // comments are excluded from all public reads.
        public bool IsHidden { get; set; }
        public bool IsDeleted { get; set; }

        public int UpvoteCount { get; set; }
        public int DownvoteCount { get; set; }

        public bool IsEdited { get; set; }

        // JSON array of { editedAt, previousContent }; default empty array.
        [Column(TypeName = "jsonb")]
        public string EditHistory { get; set; } = "[]";

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
        public DateTime? DeletedAt { get; set; }
    }
}

using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SorobanSecurityPortalApi.Models.DbModels
{
    public enum CommentEntityType
    {
        Vulnerability = 0,
        Report = 1,
        ForumThread = 2,
        Protocol = 3,
        Auditor = 4
    }

    [Table("comment")]
    public class CommentModel
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public string Content { get; set; } = string.Empty;

        [Required]
        public string ContentHtml { get; set; } = string.Empty;

        [Required]
        public int AuthorId { get; set; }

        [Required]
        public CommentEntityType EntityType { get; set; }

        [Required]
        public int EntityId { get; set; }

        public int? ParentId { get; set; }

        public bool IsEdited { get; set; }
        public bool IsDeleted { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }

        // Relationships
        [ForeignKey("AuthorId")]
        public virtual LoginModel Author { get; set; }

        [ForeignKey("ParentId")]
        public virtual CommentModel Parent { get; set; }

        public virtual ICollection<CommentModel> Replies { get; set; } = new List<CommentModel>();
        public virtual ICollection<CommentVoteModel> Votes { get; set; } = new List<CommentVoteModel>();
    }
}

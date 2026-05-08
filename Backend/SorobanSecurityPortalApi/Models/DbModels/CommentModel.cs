using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SorobanSecurityPortalApi.Models.DbModels
{
    public enum CommentEntityType
    {
        Protocol = 0,
        Auditor = 1,
        Company = 2,
        Vulnerability = 3,
        Report = 4
    }

    public enum VoteType
    {
        None = 0,
        Upvote = 1,
        Downvote = 2
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

        public LoginModel? Author { get; set; }

        [Required]
        public CommentEntityType EntityType { get; set; }

        [Required]
        public int EntityId { get; set; }

        public int? ParentId { get; set; }
        public CommentModel? Parent { get; set; }

        public List<CommentModel> Replies { get; set; } = new();
        public List<CommentVoteModel> Votes { get; set; } = new();

        public bool IsEdited { get; set; }
        public bool IsDeleted { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
    }
}

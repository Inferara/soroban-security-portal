using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SorobanSecurityPortalApi.Models.DbModels
{
    // Generic vote target type (extensible — ForumPost reserved for later forum voting).
    public enum VotableEntityType
    {
        Comment = 1,
        ForumPost = 2
    }

    public enum VoteType
    {
        Upvote = 1,
        Downvote = 2
    }

    [Table("vote")]
    public class VoteModel
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int UserId { get; set; }

        [Required]
        public VotableEntityType EntityType { get; set; }

        [Required]
        public int EntityId { get; set; }

        [Required]
        public VoteType VoteType { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}

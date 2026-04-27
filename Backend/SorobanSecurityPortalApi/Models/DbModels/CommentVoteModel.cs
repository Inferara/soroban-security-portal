using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SorobanSecurityPortalApi.Models.DbModels
{
    public enum VoteType
    {
        Downvote = -1,
        None = 0,
        Upvote = 1
    }

    [Table("comment_vote")]
    public class CommentVoteModel
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int CommentId { get; set; }

        [Required]
        public int UserId { get; set; }

        [Required]
        public VoteType Vote { get; set; }

        // Relationships
        [ForeignKey("CommentId")]
        public virtual CommentModel Comment { get; set; }

        [ForeignKey("UserId")]
        public virtual LoginModel User { get; set; }
    }
}

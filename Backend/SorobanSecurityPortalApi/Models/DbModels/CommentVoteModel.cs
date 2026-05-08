using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SorobanSecurityPortalApi.Models.DbModels
{
    [Table("comment_vote")]
    public class CommentVoteModel
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int CommentId { get; set; }

        public CommentModel? Comment { get; set; }

        [Required]
        public int UserId { get; set; }

        public LoginModel? User { get; set; }

        [Required]
        public VoteType Vote { get; set; }
    }
}

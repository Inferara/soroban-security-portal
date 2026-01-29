using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SorobanSecurityPortalApi.Models.DbModels
{
    [Table("mentions")]
    public class MentionModel
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int CommentId { get; set; }

        [ForeignKey("CommentId")]
        public virtual CommentModel? Comment { get; set; }

        [Required]
        public int MentionedUserId { get; set; }

        [ForeignKey("MentionedUserId")]
        public virtual LoginModel? MentionedUser { get; set; }

        public int StartIndex { get; set; }
        public int Length { get; set; }
    }
}
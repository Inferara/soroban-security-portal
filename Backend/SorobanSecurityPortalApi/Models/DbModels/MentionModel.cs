using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SorobanSecurityPortalApi.Models.DbModels
{
    [Table("mention")]
    public class MentionModel
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int CommentId { get; set; }

        // Stored by user id (not username) so username changes don't break mentions.
        [Required]
        public int MentionedUserId { get; set; }

        // Character offsets of the @token within the comment's raw content (for highlighting).
        [Required]
        public int StartPos { get; set; }

        [Required]
        public int EndPos { get; set; }
    }
}

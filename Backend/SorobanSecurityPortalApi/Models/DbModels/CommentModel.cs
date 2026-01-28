using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace SorobanSecurityPortalApi.Models.DbModels
{
    [Table("comment")]
    public class CommentModel
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Column("user_id")]
        public int UserId { get; set; }

        [ForeignKey(nameof(UserId))]
        public LoginModel User { get; set; }

        [Column("reference_id")]
        public int ReferenceId { get; set; }

        [Column("reference_type")]
        public ReferenceType ReferenceType { get; set; }

        [Column("content")]
        public string Content { get; set; }

        [Column("history", TypeName = "jsonb")]
        public List<CommentHistoryItem> History { get; set; } = new List<CommentHistoryItem>();

        [Column("created")]
        public DateTime Created { get; set; }

        [Column("last_edited")]
        public DateTime? LastEdited { get; set; }

        [Column("is_deleted")]
        public bool IsDeleted { get; set; }
    }

    public class CommentHistoryItem
    {
        public string Content { get; set; }
        public DateTime EditedAt { get; set; }
    }

    public enum ReferenceType
    {
        Report = 1,
        Protocol = 2,
        Auditor = 3,
        Vulnerability = 4
    }
}

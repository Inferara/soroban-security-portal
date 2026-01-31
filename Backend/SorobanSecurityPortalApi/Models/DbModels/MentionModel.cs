using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SorobanSecurityPortalApi.Models.DbModels
{
    [Table("mention")]
    public class MentionModel
    {
        [Key]
        public int Id { get; set; }

        [ForeignKey("MentionedUser")]
        public int MentionedUserId { get; set; }
        public LoginModel MentionedUser { get; set; } = null!;

        [ForeignKey("MentionedBy")]
        public int MentionedByUserId { get; set; }
        public LoginModel MentionedBy { get; set; } = null!;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // The entity type being mentioned (report, vulnerability, comment, etc.)
        public string EntityType { get; set; } = string.Empty;

        // The ID of the entity being mentioned
        public int EntityId { get; set; }

        // Position of the mention in the text for highlighting
        public int StartPosition { get; set; }
        public int EndPosition { get; set; }

        // The original username that was mentioned (for display purposes)
        public string MentionedUsername { get; set; } = string.Empty;
    }

    public enum MentionEntityType
    {
        Report = 1,
        Vulnerability = 2,
        Comment = 3,
        Protocol = 4,
        Company = 5,
        Auditor = 6
    }
}
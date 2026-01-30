using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SorobanSecurityPortalApi.Models.DbModels
{
    [Table("moderation_log")]
    public class ModerationLogModel
    {
        [Key]
        public int Id { get; set; }
        public int UserId { get; set; }
        public string OriginalContent { get; set; } = string.Empty;
        public string SanitizedContent { get; set; } = string.Empty;
        public string FilterReason { get; set; } = string.Empty;
        public bool IsBlocked { get; set; }
        public bool RequiresModeration { get; set; }
        public string Warnings { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
    }
}

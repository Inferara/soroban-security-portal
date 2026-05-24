using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SorobanSecurityPortalApi.Models.DbModels
{
    [Table("moderation_action")]
    public class ModerationActionModel
    {
        [Key] public int Id { get; set; }
        public ModeratedContentType ContentType { get; set; }
        public int ContentId { get; set; }
        public int ModeratorId { get; set; }
        public ModerationActionType Action { get; set; }
        [MaxLength(1000)] public string? Reason { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}

using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SorobanSecurityPortalApi.Models.DbModels
{
    [Table("content_flag")]
    public class ContentFlagModel
    {
        [Key] public int Id { get; set; }
        public ModeratedContentType ContentType { get; set; }
        public int ContentId { get; set; }
        public int FlaggedByUserId { get; set; }
        public FlagReason Reason { get; set; }
        [MaxLength(1000)] public string? Comment { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}

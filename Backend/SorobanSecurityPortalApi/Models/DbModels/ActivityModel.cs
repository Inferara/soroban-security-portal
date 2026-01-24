using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SorobanSecurityPortalApi.Models.DbModels
{
    [Table("activity")]
    public class ActivityModel
    {
        [Key] 
        public int Id { get; set; }
        public ActivityType Type { get; set; }
        public int EntityId { get; set; }
        public int? LoginId { get; set; }
        public DateTime CreatedAt { get; set; }
        public string? AdditionalData { get; set; } // JSON for extra metadata
    }

    public enum ActivityType
    {
        ReportCreated = 1,
        ReportApproved = 2,
        VulnerabilityCreated = 3,
        VulnerabilityApproved = 4,
        CommentCreated = 5
    }
}

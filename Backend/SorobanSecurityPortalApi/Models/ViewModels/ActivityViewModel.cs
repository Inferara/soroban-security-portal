using SorobanSecurityPortalApi.Models.DbModels;

namespace SorobanSecurityPortalApi.Models.ViewModels
{
    public class ActivityViewModel
    {
        public int Id { get; set; }
        public ActivityType Type { get; set; }
        public string TypeLabel { get; set; } = "";
        public int EntityId { get; set; }
        public string EntityTitle { get; set; } = "";
        public int? LoginId { get; set; }
        public string ActorName { get; set; } = "";
        public DateTime CreatedAt { get; set; }
        
        // Entity-specific information
        public string? ProtocolName { get; set; }
        public int? ProtocolId { get; set; }
        public string? AuditorName { get; set; }
        public int? AuditorId { get; set; }
        public string? CompanyName { get; set; }
        public int? CompanyId { get; set; }
        public string? Severity { get; set; }
        
        // For building links
        public string EntityUrl { get; set; } = "";
    }

    public class ActivitySearchViewModel
    {
        public int? Hours { get; set; } = 24;
        public int? Limit { get; set; } = 10;
        public List<ActivityType>? ActivityTypes { get; set; }
        public bool PersonalizedForUser { get; set; } = false;
    }
}

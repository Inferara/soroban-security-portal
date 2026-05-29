using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SorobanSecurityPortalApi.Models.DbModels
{
    [Table("agent_run")]
    public class AgentRunModel
    {
        [Key]
        public int Id { get; set; }
        public string Status { get; set; } = AgentRunStatus.Queued;

        // Input
        public string SourceUrl { get; set; } = "";
        [ForeignKey("Report")]
        public int? ReportId { get; set; }
        public ReportModel? Report { get; set; }
        public string Model { get; set; } = "";
        public string PromptVersion { get; set; } = "";

        // Output (heavy text — excluded from list projection)
        public string ArticleMarkdown { get; set; } = "";
        public string FindingsJson { get; set; } = "";
        public string Transcript { get; set; } = "";
        public string Error { get; set; } = "";

        // Meta
        public int? TokensUsed { get; set; }
        public long? DurationMs { get; set; }
        public int CreatedBy { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? StartedAt { get; set; }
        public DateTime? FinishedAt { get; set; }

        // Provenance (set on approve)
        public int? CreatedReportId { get; set; }
        [Column(TypeName = "jsonb")]
        public List<int>? CreatedVulnerabilityIds { get; set; }
    }

    public class AgentRunStatus
    {
        public const string Queued = "queued";
        public const string Processing = "processing";
        public const string Succeeded = "succeeded";
        public const string Failed = "failed";
        public const string Approved = "approved";
        public const string Rejected = "rejected";
    }

    public class AgentFinding
    {
        public string Title { get; set; } = "";
        public string Description { get; set; } = "";
        public string Severity { get; set; } = VulnerabilitySeverity.Note;
        public List<string> Tags { get; set; } = new();
        public VulnerabilityCategory Category { get; set; } = VulnerabilityCategory.NA;
    }

    public class AgentRunResult
    {
        public bool Success { get; set; }
        public string? ArticleMarkdown { get; set; }
        public string? FindingsJson { get; set; }
        public string? Transcript { get; set; }
        public int? TokensUsed { get; set; }
        public long? DurationMs { get; set; }
        public string? Error { get; set; }
    }
}

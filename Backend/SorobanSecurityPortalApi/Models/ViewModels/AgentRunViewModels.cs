using SorobanSecurityPortalApi.Models.DbModels;

namespace SorobanSecurityPortalApi.Models.ViewModels
{
    // Request to enqueue a run. Exactly one of SourceUrl / ReportId should be set.
    public class EnqueueAgentRunViewModel
    {
        public string? SourceUrl { get; set; }
        public int? ReportId { get; set; }
        public string? Model { get; set; }
    }

    // Slim row for the admin list (no heavy text).
    public class AgentRunListItemViewModel
    {
        public int Id { get; set; }
        public string Status { get; set; } = "";
        public string SourceUrl { get; set; } = "";
        public int? ReportId { get; set; }
        public string Model { get; set; } = "";
        public string Error { get; set; } = "";
        public int? TokensUsed { get; set; }
        public long? DurationMs { get; set; }
        public int CreatedBy { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? StartedAt { get; set; }
        public DateTime? FinishedAt { get; set; }
        public int? CreatedReportId { get; set; }
    }

    public class AgentRunListResultViewModel
    {
        public List<AgentRunListItemViewModel> Items { get; set; } = new();
        public int Total { get; set; }
    }

    // Full detail incl. article, parsed findings, and reasoning transcript.
    public class AgentRunViewModel : AgentRunListItemViewModel
    {
        public string PromptVersion { get; set; } = "";
        public string ArticleMarkdown { get; set; } = "";
        public List<AgentFinding> Findings { get; set; } = new();
        public string Transcript { get; set; } = "";
        public List<int>? CreatedVulnerabilityIds { get; set; }
        public bool FindingsUnparseable { get; set; }
    }

    // Worker→backend submit payload (mirrors AgentRunResult).
    public class SubmitAgentRunResultViewModel
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

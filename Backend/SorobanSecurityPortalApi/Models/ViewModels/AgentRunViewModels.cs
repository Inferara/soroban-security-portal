using SorobanSecurityPortalApi.Models.DbModels;

namespace SorobanSecurityPortalApi.Models.ViewModels
{
    // Request to enqueue a run. Exactly one of SourceUrl / ReportId should be set.
    public class EnqueueAgentRunViewModel
    {
        public string? SourceUrl { get; set; }
        public int? ReportId { get; set; }
        public string? Model { get; set; }
        // Bypass the "this source URL was already ingested / is in flight" dedup guard.
        public bool Force { get; set; }
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
        public string ReportTitle { get; set; } = "";
        public string ProtocolName { get; set; } = "";
        public string AuditorName { get; set; } = "";
        public DateTime? ReportDate { get; set; }
        public string ReportPdfUrl { get; set; } = "";
    }

    public class ApproveAgentRunViewModel
    {
        public string ReportTitle { get; set; } = "";
        public string ProtocolName { get; set; } = "";
        public string AuditorName { get; set; } = "";
        public DateTime? ReportDate { get; set; }
        public string ArticleMarkdown { get; set; } = "";
        public List<AgentFinding> Findings { get; set; } = new();
        public string ReportPdfUrl { get; set; } = "";
    }

    public class AgentExampleArticle { public string Title { get; set; } = ""; public string Markdown { get; set; } = ""; }
    public class AgentExampleVulnerability
    {
        public string Title { get; set; } = ""; public string Severity { get; set; } = "";
        public int Category { get; set; } public List<string> Tags { get; set; } = new(); public string Description { get; set; } = "";
    }
    public class AgentExamplesViewModel
    {
        public List<AgentExampleArticle> Articles { get; set; } = new();
        public List<AgentExampleVulnerability> Vulnerabilities { get; set; } = new();
        public List<string> ExistingFindingTitles { get; set; } = new();
        // Titles of reports already in the portal — so the agent can recognize an already-ingested
        // report and avoid producing a duplicate.
        public List<string> ExistingReportTitles { get; set; } = new();
    }
    public class AgentProgressViewModel { public string? Transcript { get; set; } }

    // The tunable prompt blocks (from Admin Settings) served to the worker.
    public class AgentPromptConfigViewModel
    {
        public string Preamble { get; set; } = "";
        public string Instructions { get; set; } = "";
        public string ExamplesGuidance { get; set; } = "";
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
        public string? ReportTitle { get; set; }
        public string? ProtocolName { get; set; }
        public string? AuditorName { get; set; }
        public DateTime? ReportDate { get; set; }
        public string? ReportPdfUrl { get; set; }
    }
}

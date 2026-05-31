namespace AgentIngestionWorker.Api;

public sealed class ClaimedRun
{
    public int Id { get; set; }
    public string SourceUrl { get; set; } = "";
    public int? ReportId { get; set; }
    public string Model { get; set; } = "";
}

public sealed class SubmitResultDto
{
    public bool Success { get; set; }
    public string? ArticleMarkdown { get; set; }
    public string? FindingsJson { get; set; }
    public string? Transcript { get; set; }
    public long? DurationMs { get; set; }
    public string? Error { get; set; }
    public string? ReportTitle { get; set; }
    public string? ProtocolName { get; set; }
    public string? AuditorName { get; set; }
    public DateTime? ReportDate { get; set; }
    public string? ReportPdfUrl { get; set; }
}

public sealed class AgentExampleArticleDto
{
    public string Title { get; set; } = "";
    public string Markdown { get; set; } = "";
}

public sealed class AgentExampleVulnDto
{
    public string Title { get; set; } = "";
    public string Severity { get; set; } = "";
    public int Category { get; set; }
    public List<string> Tags { get; set; } = new();
    public string Description { get; set; } = "";
}

public sealed class AgentExamplesDto
{
    public List<AgentExampleArticleDto> Articles { get; set; } = new();
    public List<AgentExampleVulnDto> Vulnerabilities { get; set; } = new();
    public List<string> ExistingFindingTitles { get; set; } = new();
    public List<string> ExistingReportTitles { get; set; } = new();
}

public sealed class AgentProgressDto
{
    public string? Transcript { get; set; }
}

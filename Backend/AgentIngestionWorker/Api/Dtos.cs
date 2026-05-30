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
}

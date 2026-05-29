namespace AgentIngestionWorker.OpenCode;

public sealed class OpenCodeResult
{
    public bool Success { get; init; }
    public string ArticleMarkdown { get; init; } = "";
    public string ResultJson { get; init; } = "";   // raw result.json (parsed by the worker in Task 2)
    public string Transcript { get; init; } = "";    // captured stdout
    public string? Error { get; init; }
    public long DurationMs { get; init; }
}

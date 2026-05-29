namespace AgentIngestionWorker.OpenCode;

public interface IOpenCodeRunner
{
    Task<OpenCodeResult> RunAsync(string promptText, CancellationToken ct);
}

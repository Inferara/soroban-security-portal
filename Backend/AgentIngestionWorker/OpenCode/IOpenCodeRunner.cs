namespace AgentIngestionWorker.OpenCode;

public interface IOpenCodeRunner
{
    Task<OpenCodeResult> RunAsync(string promptText, IReadOnlyList<SeedFile>? seedFiles, Action<string>? onProgress, CancellationToken ct);
}

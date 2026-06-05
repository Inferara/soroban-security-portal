using AgentIngestionWorker.OpenCode;

namespace AgentIngestionWorker.Worker;

public sealed class PromptBuild
{
    public string PromptText { get; init; } = "";
    public List<SeedFile> SeedFiles { get; init; } = new();
}

using AgentIngestionWorker.Api;

namespace AgentIngestionWorker.Worker;

public interface IIngestionPrompt
{
    Task<string> BuildAsync(ClaimedRun run, CancellationToken ct);
}

public sealed class IngestionPrompt : IIngestionPrompt
{
    public Task<string> BuildAsync(ClaimedRun run, CancellationToken ct)
    {
        var prompt = $@"You are an audit-report ingestion agent for a Soroban/Stellar security portal.
Fetch and read the audit report at: {run.SourceUrl}
Write EXACTLY two files in the current directory:
1. article.md — a consistent Markdown article (title, metadata, ## Summary, ## Scope, ## Findings with one ### per finding).
2. result.json — {{ ""reportTitle"": string, ""protocolName"": string (audited project), ""auditorName"": string, ""reportDate"": ""YYYY-MM-DD"" or null, ""findings"": [ {{ ""title"": string, ""description"": string, ""severity"": ""critical""|""high""|""medium""|""low""|""note"", ""tags"": string[], ""category"": 0 }} ] }}.
Map observation/informational to ""note""; if a finding is fixed/resolved use category 0. Extract ALL findings. Output ONLY those two files.";
        return Task.FromResult(prompt);
    }
}

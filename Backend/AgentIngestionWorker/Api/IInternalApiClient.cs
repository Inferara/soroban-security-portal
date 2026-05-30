namespace AgentIngestionWorker.Api;

public interface IInternalApiClient
{
    Task<ClaimedRun?> ClaimNextAsync(CancellationToken ct);
    Task SubmitAsync(int id, SubmitResultDto result, CancellationToken ct);
    Task<AgentExamplesDto> GetExamplesAsync(CancellationToken ct);
    Task ProgressAsync(int id, string transcript, CancellationToken ct);
}

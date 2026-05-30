namespace AgentIngestionWorker.Api;

public interface IInternalApiClient
{
    Task<ClaimedRun?> ClaimNextAsync(CancellationToken ct);
    Task SubmitAsync(int id, SubmitResultDto result, CancellationToken ct);
}

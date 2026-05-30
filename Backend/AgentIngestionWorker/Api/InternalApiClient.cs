using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace AgentIngestionWorker.Api;

public sealed class InternalApiClient : IInternalApiClient
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    private readonly HttpClient _http;

    public InternalApiClient(HttpClient http) => _http = http;

    public async Task<ClaimedRun?> ClaimNextAsync(CancellationToken ct)
    {
        using var resp = await _http.PostAsync("api/v1/agent-runs/internal/claim-next", null, ct);
        if (resp.StatusCode == HttpStatusCode.NoContent) return null;
        resp.EnsureSuccessStatusCode();
        return await resp.Content.ReadFromJsonAsync<ClaimedRun>(Json, ct);
    }

    public async Task SubmitAsync(int id, SubmitResultDto result, CancellationToken ct)
    {
        using var resp = await _http.PostAsJsonAsync($"api/v1/agent-runs/internal/{id}/submit", result, Json, ct);
        resp.EnsureSuccessStatusCode();
    }

    public async Task<AgentExamplesDto> GetExamplesAsync(CancellationToken ct)
    {
        using var resp = await _http.GetAsync("api/v1/agent-runs/internal/examples", ct);
        resp.EnsureSuccessStatusCode();
        return await resp.Content.ReadFromJsonAsync<AgentExamplesDto>(Json, ct) ?? new AgentExamplesDto();
    }

    public async Task ProgressAsync(int id, string transcript, CancellationToken ct)
    {
        using var resp = await _http.PostAsJsonAsync($"api/v1/agent-runs/internal/{id}/progress", new AgentProgressDto { Transcript = transcript }, Json, ct);
        resp.EnsureSuccessStatusCode();
    }
}

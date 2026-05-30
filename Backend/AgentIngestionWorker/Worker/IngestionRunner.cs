using System.Text.Json;
using AgentIngestionWorker.Api;
using AgentIngestionWorker.OpenCode;
using Microsoft.Extensions.Logging;

namespace AgentIngestionWorker.Worker;

public sealed class IngestionRunnerOptions
{
    public TimeSpan PollInterval { get; init; } = TimeSpan.FromSeconds(15);
}

public sealed class IngestionRunner
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    private readonly IInternalApiClient _api;
    private readonly IOpenCodeRunner _runner;
    private readonly IIngestionPrompt _prompt;
    private readonly IngestionRunnerOptions _opts;
    private readonly ILogger<IngestionRunner> _logger;

    public IngestionRunner(
        IInternalApiClient api,
        IOpenCodeRunner runner,
        IIngestionPrompt prompt,
        IngestionRunnerOptions opts,
        ILogger<IngestionRunner> logger)
    {
        _api = api;
        _runner = runner;
        _prompt = prompt;
        _opts = opts;
        _logger = logger;
    }

    /// <summary>Returns true if a run was processed, false if the queue was empty.</summary>
    public async Task<bool> ProcessOneAsync(CancellationToken ct)
    {
        var run = await _api.ClaimNextAsync(ct);
        if (run == null) return false;

        SubmitResultDto submit;
        try
        {
            var prompt = await _prompt.BuildAsync(run, ct);
            var result = await _runner.RunAsync(prompt, ct);
            submit = MapToSubmit(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Ingestion failed for run {Id}", run.Id);
            submit = new SubmitResultDto { Success = false, Error = ex.Message };
        }

        await _api.SubmitAsync(run.Id, submit, ct);
        return true;
    }

    public async Task RunLoopAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            bool processed;
            try
            {
                processed = await ProcessOneAsync(ct);
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Worker loop iteration error");
                processed = false;
            }

            if (!processed)
            {
                try { await Task.Delay(_opts.PollInterval, ct); }
                catch (OperationCanceledException) { break; }
            }
        }
    }

    internal static SubmitResultDto MapToSubmit(OpenCodeResult result)
    {
        var dto = new SubmitResultDto
        {
            Success = result.Success,
            ArticleMarkdown = result.ArticleMarkdown,
            Transcript = result.Transcript,
            DurationMs = result.DurationMs,
            Error = result.Error,
        };

        if (!result.Success) return dto;

        try
        {
            using var doc = JsonDocument.Parse(
                string.IsNullOrWhiteSpace(result.ResultJson) ? "{}" : result.ResultJson);
            var root = doc.RootElement;

            dto.ReportTitle = GetStr(root, "reportTitle");
            dto.ProtocolName = GetStr(root, "protocolName");
            dto.AuditorName = GetStr(root, "auditorName");

            if (root.TryGetProperty("reportDate", out var rd)
                && rd.ValueKind == JsonValueKind.String
                && DateTime.TryParse(rd.GetString(), out var d))
            {
                dto.ReportDate = DateTime.SpecifyKind(d, DateTimeKind.Utc);
            }

            dto.FindingsJson = root.TryGetProperty("findings", out var f)
                && f.ValueKind == JsonValueKind.Array
                ? f.GetRawText()
                : "[]";
        }
        catch (JsonException)
        {
            dto.FindingsJson = "[]";
            dto.Error = string.IsNullOrEmpty(dto.Error)
                ? "result.json was not valid JSON"
                : dto.Error;
        }

        return dto;
    }

    private static string? GetStr(JsonElement root, string name)
        => root.TryGetProperty(name, out var p) && p.ValueKind == JsonValueKind.String
            ? p.GetString()
            : null;
}

using System.Text;

namespace AgentIngestionWorker.OpenCode;

public sealed class OpenCodeRunnerOptions
{
    public string Model { get; init; } = "zai-coding-plan/glm-5.1";
    public string OpenCodeBin { get; init; } = "opencode";
    public TimeSpan Timeout { get; init; } = TimeSpan.FromMinutes(7);
    public TimeSpan StallTimeout { get; init; } = TimeSpan.FromSeconds(90);
    public Dictionary<string, string> ExtraEnv { get; init; } = new(); // e.g. HOME, PATH
}

public sealed class OpenCodeRunner : IOpenCodeRunner
{
    private readonly IProcessRunner _processRunner;
    private readonly OpenCodeRunnerOptions _opts;

    public OpenCodeRunner(IProcessRunner processRunner, OpenCodeRunnerOptions opts)
    {
        _processRunner = processRunner;
        _opts = opts;
    }

    public async Task<OpenCodeResult> RunAsync(string promptText, IReadOnlyList<SeedFile>? seedFiles, Action<string>? onProgress, CancellationToken ct)
    {
        var ws = Path.Combine(Path.GetTempPath(), "agent-ingestion-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(ws);
        try
        {
            // Write seed files into workspace (guard against path traversal)
            if (seedFiles != null)
            {
                foreach (var sf in seedFiles)
                {
                    if (string.IsNullOrWhiteSpace(sf.RelativePath) || sf.RelativePath.Contains(".."))
                        continue; // reject path traversal attempts
                    var dest = Path.Combine(ws, sf.RelativePath);
                    var dir = Path.GetDirectoryName(dest);
                    if (dir != null) Directory.CreateDirectory(dir);
                    await File.WriteAllTextAsync(dest, sf.Content, ct);
                }
            }

            var transcript = new StringBuilder();
            var lastProgress = DateTime.MinValue;

            var spec = new ProcessSpec
            {
                FileName = _opts.OpenCodeBin,
                WorkingDir = ws,
                Timeout = _opts.Timeout,
                StallTimeout = _opts.StallTimeout,
                Args =
                {
                    "run", "-m", _opts.Model,
                    "--dangerously-skip-permissions",
                    "--format", "json",
                    "--dir", ws,
                    promptText,
                },
                OnStdoutLine = line =>
                {
                    OpenCodeTranscriptFormatter.Append(transcript, line);
                    var now = DateTime.UtcNow;
                    if (onProgress != null && (now - lastProgress).TotalMilliseconds > 2000)
                    {
                        lastProgress = now;
                        onProgress(transcript.ToString());
                    }
                },
            };
            foreach (var kv in _opts.ExtraEnv) spec.Env[kv.Key] = kv.Value;

            var pr = await _processRunner.RunAsync(spec, ct);
            var finalTranscript = transcript.ToString();

            if (pr.TimedOut)
            {
                onProgress?.Invoke(finalTranscript);
                return new OpenCodeResult { Success = false, Transcript = finalTranscript, DurationMs = pr.DurationMs,
                    Error = $"opencode timed out after {_opts.Timeout.TotalMinutes:0} min" };
            }
            if (pr.Stalled)
            {
                onProgress?.Invoke(finalTranscript);
                return new OpenCodeResult { Success = false, Transcript = finalTranscript, DurationMs = pr.DurationMs,
                    Error = "opencode made no progress (stalled) and was killed" };
            }

            var articlePath = Path.Combine(ws, "article.md");
            var resultPath = Path.Combine(ws, "result.json");
            var article = File.Exists(articlePath) ? await File.ReadAllTextAsync(articlePath, ct) : "";
            var resultJson = File.Exists(resultPath) ? await File.ReadAllTextAsync(resultPath, ct) : "";

            if (pr.ExitCode != 0 && string.IsNullOrWhiteSpace(resultJson) && string.IsNullOrWhiteSpace(article))
            {
                onProgress?.Invoke(finalTranscript);
                return new OpenCodeResult { Success = false, Transcript = finalTranscript, DurationMs = pr.DurationMs,
                    Error = $"opencode exited {pr.ExitCode}: {Trim(pr.Stderr)}" };
            }

            if (string.IsNullOrWhiteSpace(resultJson) && string.IsNullOrWhiteSpace(article))
            {
                onProgress?.Invoke(finalTranscript);
                return new OpenCodeResult { Success = false, Transcript = finalTranscript, DurationMs = pr.DurationMs,
                    Error = "opencode produced no article.md or result.json" };
            }

            onProgress?.Invoke(finalTranscript);
            return new OpenCodeResult
            {
                Success = true,
                ArticleMarkdown = article,
                ResultJson = resultJson,
                Transcript = finalTranscript,
                DurationMs = pr.DurationMs,
            };
        }
        finally
        {
            try { Directory.Delete(ws, recursive: true); } catch { }
        }
    }

    private static string Trim(string s) => s.Length > 500 ? s[..500] : s;
}

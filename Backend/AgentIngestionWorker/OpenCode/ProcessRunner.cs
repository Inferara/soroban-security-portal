using System.Diagnostics;
using System.Text;

namespace AgentIngestionWorker.OpenCode;

public sealed class ProcessSpec
{
    public required string FileName { get; init; }
    public List<string> Args { get; init; } = new();
    public required string WorkingDir { get; init; }
    public Dictionary<string, string> Env { get; init; } = new();
    public TimeSpan Timeout { get; init; } = TimeSpan.FromMinutes(7);
    public TimeSpan StallTimeout { get; init; } = TimeSpan.FromSeconds(90);
}

public sealed class ProcessResult
{
    public int ExitCode { get; init; }
    public string Stdout { get; init; } = "";
    public string Stderr { get; init; } = "";
    public bool TimedOut { get; init; }
    public bool Stalled { get; init; }
    public long DurationMs { get; init; }
}

public interface IProcessRunner
{
    Task<ProcessResult> RunAsync(ProcessSpec spec, CancellationToken ct);
}

// Anti-hang real implementation. Mirrors ClaudeCodeRunner:
// - linked CTS + CancelAfter(Timeout) => hard wall-clock cap
// - stall watchdog: if no stdout line for StallTimeout, treat as stalled and kill
// - background stderr reader (avoid pipe deadlock); close stdin immediately
// - Kill(entireProcessTree: true) on timeout/stall
public sealed class RealProcessRunner : IProcessRunner
{
    public async Task<ProcessResult> RunAsync(ProcessSpec spec, CancellationToken ct)
    {
        var sw = Stopwatch.StartNew();
        var psi = new ProcessStartInfo(spec.FileName)
        {
            UseShellExecute = false,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            RedirectStandardInput = true,
            CreateNoWindow = true,
            WorkingDirectory = spec.WorkingDir,
        };
        foreach (var a in spec.Args) psi.ArgumentList.Add(a);
        foreach (var kv in spec.Env) psi.Environment[kv.Key] = kv.Value;

        using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        timeoutCts.CancelAfter(spec.Timeout);

        using var process = Process.Start(psi)
            ?? throw new InvalidOperationException($"Failed to start process: {spec.FileName}");
        process.StandardInput.Close();

        var stderr = new StringBuilder();
        var stderrTask = Task.Run(async () =>
        {
            try { while (await process.StandardError.ReadLineAsync() is { } l) stderr.AppendLine(l); }
            catch { /* best effort */ }
        });

        var stdout = new StringBuilder();
        var lastOutput = DateTime.UtcNow;
        var stalled = false;
        var timedOut = false;

        // Stall watchdog: kill if no stdout progress within StallTimeout.
        using var watchdogCts = CancellationTokenSource.CreateLinkedTokenSource(timeoutCts.Token);
        var watchdog = Task.Run(async () =>
        {
            try
            {
                while (!watchdogCts.Token.IsCancellationRequested)
                {
                    await Task.Delay(TimeSpan.FromSeconds(5), watchdogCts.Token);
                    if (DateTime.UtcNow - lastOutput > spec.StallTimeout)
                    {
                        stalled = true;
                        try { process.Kill(entireProcessTree: true); } catch { }
                        return;
                    }
                }
            }
            catch (OperationCanceledException) { }
        });

        try
        {
            while (await process.StandardOutput.ReadLineAsync(timeoutCts.Token) is { } line)
            {
                stdout.AppendLine(line);
                lastOutput = DateTime.UtcNow;
            }
            await process.WaitForExitAsync(timeoutCts.Token);
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            timedOut = true;
            try { process.Kill(entireProcessTree: true); } catch { }
        }
        finally
        {
            watchdogCts.Cancel();
            try { await stderrTask; } catch { }
        }

        sw.Stop();
        int exit;
        try { exit = process.HasExited ? process.ExitCode : -1; } catch { exit = -1; }
        return new ProcessResult
        {
            ExitCode = exit,
            Stdout = stdout.ToString(),
            Stderr = stderr.ToString(),
            TimedOut = timedOut,
            Stalled = stalled,
            DurationMs = sw.ElapsedMilliseconds,
        };
    }
}

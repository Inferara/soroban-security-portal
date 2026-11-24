using AgentIngestionWorker.OpenCode;

namespace AgentIngestionWorker.Tests;

/// <summary>
/// Integration tests for RealProcessRunner using trivial system commands.
/// These tests are fast (sub-second for success, ~1-2s for timeout) and run on Windows
/// (via <c>cmd /c</c>) as well as Linux/macOS (via <c>/bin/sh -c</c>).
/// Marked with [Trait("Category","Integration")] so they can be excluded if needed.
/// </summary>
public class RealProcessRunnerTests
{
    private readonly RealProcessRunner _runner = new();

    // Runs a one-line command through the platform's shell: cmd on Windows, sh elsewhere.
    private static ProcessSpec ShellSpec(string windowsCommand, string unixCommand, string workingDir, TimeSpan timeout, TimeSpan stallTimeout)
        => new()
        {
            FileName = OperatingSystem.IsWindows() ? "cmd" : "/bin/sh",
            Args = OperatingSystem.IsWindows()
                ? new List<string> { "/c", windowsCommand }
                : new List<string> { "-c", unixCommand },
            WorkingDir = workingDir,
            Timeout = timeout,
            StallTimeout = stallTimeout,
        };

    [Fact]
    [Trait("Category", "Integration")]
    public async Task Success_EchoCommand_ReturnsExitZeroAndCapturesStdout()
    {
        var tmpDir = Path.Combine(Path.GetTempPath(), "rpr-test-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(tmpDir);
        try
        {
            var spec = ShellSpec(
                windowsCommand: "echo hi",
                unixCommand: "echo hi",
                workingDir: tmpDir,
                timeout: TimeSpan.FromSeconds(10),
                stallTimeout: TimeSpan.FromSeconds(5));

            var result = await _runner.RunAsync(spec, CancellationToken.None);

            result.ExitCode.Should().Be(0);
            result.Stdout.Should().Contain("hi");
            result.TimedOut.Should().BeFalse();
            result.Stalled.Should().BeFalse();
        }
        finally
        {
            try { Directory.Delete(tmpDir, recursive: true); } catch { }
        }
    }

    [Fact]
    [Trait("Category", "Integration")]
    public async Task Timeout_SlowCommand_ReturnsTimedOut()
    {
        var tmpDir = Path.Combine(Path.GetTempPath(), "rpr-test-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(tmpDir);
        try
        {
            // ping -n 10 takes ~9 seconds (sleep 10 takes 10); we give only 1s timeout
            var spec = ShellSpec(
                windowsCommand: "ping -n 10 127.0.0.1",
                unixCommand: "sleep 10",
                workingDir: tmpDir,
                timeout: TimeSpan.FromSeconds(1),
                stallTimeout: TimeSpan.FromSeconds(30)); // stall timeout longer than wall-clock so only wall-clock fires

            var result = await _runner.RunAsync(spec, CancellationToken.None);

            result.TimedOut.Should().BeTrue();
        }
        finally
        {
            try { Directory.Delete(tmpDir, recursive: true); } catch { }
        }
    }
}

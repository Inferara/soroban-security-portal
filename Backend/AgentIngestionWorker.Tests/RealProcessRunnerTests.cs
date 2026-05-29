using AgentIngestionWorker.OpenCode;

namespace AgentIngestionWorker.Tests;

/// <summary>
/// Integration tests for RealProcessRunner using trivial system commands.
/// These tests are fast (sub-second for success, ~1-2s for timeout) and Windows-only.
/// Marked with [Trait("Category","Integration")] so they can be excluded if needed.
/// </summary>
public class RealProcessRunnerTests
{
    private readonly RealProcessRunner _runner = new();

    [Fact]
    [Trait("Category", "Integration")]
    public async Task Success_EchoCommand_ReturnsExitZeroAndCapturesStdout()
    {
        var tmpDir = Path.Combine(Path.GetTempPath(), "rpr-test-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(tmpDir);
        try
        {
            var spec = new ProcessSpec
            {
                FileName = "cmd",
                Args = { "/c", "echo hi" },
                WorkingDir = tmpDir,
                Timeout = TimeSpan.FromSeconds(10),
                StallTimeout = TimeSpan.FromSeconds(5),
            };

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
            // ping -n 10 takes ~9 seconds; we give only 1s timeout
            var spec = new ProcessSpec
            {
                FileName = "cmd",
                Args = { "/c", "ping -n 10 127.0.0.1" },
                WorkingDir = tmpDir,
                Timeout = TimeSpan.FromSeconds(1),
                StallTimeout = TimeSpan.FromSeconds(30), // stall timeout longer than wall-clock so only wall-clock fires
            };

            var result = await _runner.RunAsync(spec, CancellationToken.None);

            result.TimedOut.Should().BeTrue();
        }
        finally
        {
            try { Directory.Delete(tmpDir, recursive: true); } catch { }
        }
    }
}

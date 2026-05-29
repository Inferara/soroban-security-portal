using AgentIngestionWorker.OpenCode;

namespace AgentIngestionWorker.Tests;

public class OpenCodeRunnerTests
{
    private static OpenCodeRunnerOptions DefaultOpts() => new()
    {
        Model = "test-model",
        OpenCodeBin = "opencode",
        Timeout = TimeSpan.FromMinutes(7),
        StallTimeout = TimeSpan.FromSeconds(90),
    };

    // Helper: build a mock IProcessRunner that, before returning, optionally writes files into the WorkingDir.
    private static Mock<IProcessRunner> BuildFakeRunner(
        ProcessResult result,
        Action<string>? writeFiles = null)
    {
        var mock = new Mock<IProcessRunner>();
        mock.Setup(r => r.RunAsync(It.IsAny<ProcessSpec>(), It.IsAny<CancellationToken>()))
            .Returns<ProcessSpec, CancellationToken>((spec, _) =>
            {
                writeFiles?.Invoke(spec.WorkingDir);
                return Task.FromResult(result);
            });
        return mock;
    }

    // -----------------------------------------------------------------------
    // Success: article.md + result.json written, exit 0
    // -----------------------------------------------------------------------
    [Fact]
    public async Task Success_WritesArticleAndResult_ReturnsSuccess()
    {
        var pr = new ProcessResult { ExitCode = 0, Stdout = "some log", DurationMs = 42 };
        var mock = BuildFakeRunner(pr, ws =>
        {
            File.WriteAllText(Path.Combine(ws, "article.md"), "# A");
            File.WriteAllText(Path.Combine(ws, "result.json"), "{\"key\":\"val\"}");
        });

        var runner = new OpenCodeRunner(mock.Object, DefaultOpts());
        var result = await runner.RunAsync("my prompt", CancellationToken.None);

        result.Success.Should().BeTrue();
        result.ArticleMarkdown.Should().Be("# A");
        result.ResultJson.Should().Contain("key");
        result.DurationMs.Should().Be(42);
        result.Error.Should().BeNull();
    }

    // -----------------------------------------------------------------------
    // Timed out
    // -----------------------------------------------------------------------
    [Fact]
    public async Task TimedOut_ReturnsFailureWithTimedOutError()
    {
        var pr = new ProcessResult { TimedOut = true, Stdout = "partial", DurationMs = 420000 };
        var mock = BuildFakeRunner(pr);

        var runner = new OpenCodeRunner(mock.Object, DefaultOpts());
        var result = await runner.RunAsync("my prompt", CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Error.Should().Contain("timed out");
        result.Transcript.Should().Be("partial");
    }

    // -----------------------------------------------------------------------
    // Stalled
    // -----------------------------------------------------------------------
    [Fact]
    public async Task Stalled_ReturnsFailureWithStalledError()
    {
        var pr = new ProcessResult { Stalled = true, Stdout = "stuck", DurationMs = 91000 };
        var mock = BuildFakeRunner(pr);

        var runner = new OpenCodeRunner(mock.Object, DefaultOpts());
        var result = await runner.RunAsync("my prompt", CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Error.Should().Contain("stalled");
        result.Transcript.Should().Be("stuck");
    }

    // -----------------------------------------------------------------------
    // Crash: non-zero exit, no files written
    // -----------------------------------------------------------------------
    [Fact]
    public async Task Crash_NonZeroExitNoFiles_ReturnsFailureWithExitedError()
    {
        var pr = new ProcessResult { ExitCode = 1, Stderr = "fatal error occurred", DurationMs = 100 };
        var mock = BuildFakeRunner(pr);

        var runner = new OpenCodeRunner(mock.Object, DefaultOpts());
        var result = await runner.RunAsync("my prompt", CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Error.Should().Contain("exited");
    }

    // -----------------------------------------------------------------------
    // No files, exit 0: opencode produced nothing
    // -----------------------------------------------------------------------
    [Fact]
    public async Task NoFiles_Exit0_ReturnsFailureWithNoArticleError()
    {
        var pr = new ProcessResult { ExitCode = 0, DurationMs = 50 };
        var mock = BuildFakeRunner(pr); // no file-writing callback => nothing written

        var runner = new OpenCodeRunner(mock.Object, DefaultOpts());
        var result = await runner.RunAsync("my prompt", CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Error.Should().Contain("no article");
    }

    // -----------------------------------------------------------------------
    // Partial: only article.md present (no result.json), exit 0 => Success
    // (worker handles missing findings downstream in Task 2)
    // -----------------------------------------------------------------------
    [Fact]
    public async Task PartialArticleOnly_NoResultJson_ReturnsSuccess()
    {
        var pr = new ProcessResult { ExitCode = 0, DurationMs = 80 };
        var mock = BuildFakeRunner(pr, ws =>
        {
            File.WriteAllText(Path.Combine(ws, "article.md"), "# Partial Article");
            // result.json intentionally NOT written
        });

        var runner = new OpenCodeRunner(mock.Object, DefaultOpts());
        var result = await runner.RunAsync("my prompt", CancellationToken.None);

        result.Success.Should().BeTrue();
        result.ArticleMarkdown.Should().Be("# Partial Article");
        result.ResultJson.Should().BeEmpty();
    }

    // -----------------------------------------------------------------------
    // Verify ProcessSpec args contain the right values
    // -----------------------------------------------------------------------
    [Fact]
    public async Task RunAsync_PassesCorrectArgsToProcessRunner()
    {
        var capturedSpec = default(ProcessSpec);
        var pr = new ProcessResult { ExitCode = 0, DurationMs = 10 };

        var mock = new Mock<IProcessRunner>();
        mock.Setup(r => r.RunAsync(It.IsAny<ProcessSpec>(), It.IsAny<CancellationToken>()))
            .Returns<ProcessSpec, CancellationToken>((spec, _) =>
            {
                capturedSpec = spec;
                File.WriteAllText(Path.Combine(spec.WorkingDir, "article.md"), "# T");
                return Task.FromResult(pr);
            });

        var opts = new OpenCodeRunnerOptions
        {
            Model = "my-special-model",
            OpenCodeBin = "opencode",
        };
        var runner = new OpenCodeRunner(mock.Object, opts);
        await runner.RunAsync("the prompt text", CancellationToken.None);

        capturedSpec.Should().NotBeNull();
        capturedSpec!.FileName.Should().Be("opencode");
        capturedSpec.Args.Should().Contain("run");
        capturedSpec.Args.Should().Contain("-m");
        capturedSpec.Args.Should().Contain("my-special-model");
        capturedSpec.Args.Should().Contain("--dangerously-skip-permissions");
        capturedSpec.Args.Should().Contain("--print-logs");
        capturedSpec.Args.Should().Contain("--dir");
        capturedSpec.Args.Should().Contain("the prompt text");
    }

    // -----------------------------------------------------------------------
    // Extra env vars are forwarded to ProcessSpec
    // -----------------------------------------------------------------------
    [Fact]
    public async Task ExtraEnv_ForwardedToSpec()
    {
        var capturedSpec = default(ProcessSpec);
        var pr = new ProcessResult { ExitCode = 0, DurationMs = 5 };

        var mock = new Mock<IProcessRunner>();
        mock.Setup(r => r.RunAsync(It.IsAny<ProcessSpec>(), It.IsAny<CancellationToken>()))
            .Returns<ProcessSpec, CancellationToken>((spec, _) =>
            {
                capturedSpec = spec;
                File.WriteAllText(Path.Combine(spec.WorkingDir, "result.json"), "{}");
                return Task.FromResult(pr);
            });

        var opts = new OpenCodeRunnerOptions
        {
            ExtraEnv = new Dictionary<string, string> { ["MY_KEY"] = "MY_VAL" },
        };
        var runner = new OpenCodeRunner(mock.Object, opts);
        await runner.RunAsync("p", CancellationToken.None);

        capturedSpec!.Env.Should().ContainKey("MY_KEY").WhoseValue.Should().Be("MY_VAL");
    }
}

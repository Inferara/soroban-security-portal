using System.Text;
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

    // Helper: build a mock IProcessRunner that, before returning, optionally writes files into the WorkingDir
    // and optionally invokes OnStdoutLine with sample lines.
    private static Mock<IProcessRunner> BuildFakeRunner(
        ProcessResult result,
        Action<string>? writeFiles = null,
        IEnumerable<string>? stdoutLines = null)
    {
        var mock = new Mock<IProcessRunner>();
        mock.Setup(r => r.RunAsync(It.IsAny<ProcessSpec>(), It.IsAny<CancellationToken>()))
            .Returns<ProcessSpec, CancellationToken>((spec, _) =>
            {
                if (stdoutLines != null)
                {
                    foreach (var line in stdoutLines)
                        spec.OnStdoutLine?.Invoke(line);
                }
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
        var result = await runner.RunAsync("my prompt", seedFiles: null, onProgress: null, CancellationToken.None);

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
        var result = await runner.RunAsync("my prompt", seedFiles: null, onProgress: null, CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Error.Should().Contain("timed out");
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
        var result = await runner.RunAsync("my prompt", seedFiles: null, onProgress: null, CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Error.Should().Contain("stalled");
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
        var result = await runner.RunAsync("my prompt", seedFiles: null, onProgress: null, CancellationToken.None);

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
        var result = await runner.RunAsync("my prompt", seedFiles: null, onProgress: null, CancellationToken.None);

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
        var result = await runner.RunAsync("my prompt", seedFiles: null, onProgress: null, CancellationToken.None);

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
        await runner.RunAsync("the prompt text", seedFiles: null, onProgress: null, CancellationToken.None);

        capturedSpec.Should().NotBeNull();
        capturedSpec!.FileName.Should().Be("opencode");
        capturedSpec.Args.Should().Contain("run");
        capturedSpec.Args.Should().Contain("-m");
        capturedSpec.Args.Should().Contain("my-special-model");
        capturedSpec.Args.Should().Contain("--dangerously-skip-permissions");
        capturedSpec.Args.Should().Contain("--format");
        capturedSpec.Args.Should().Contain("json");
        capturedSpec.Args.Should().NotContain("--print-logs");
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
        await runner.RunAsync("p", seedFiles: null, onProgress: null, CancellationToken.None);

        capturedSpec!.Env.Should().ContainKey("MY_KEY").WhoseValue.Should().Be("MY_VAL");
    }

    // -----------------------------------------------------------------------
    // Formats_Json_Events_Into_Transcript
    // -----------------------------------------------------------------------
    [Fact]
    public async Task Formats_Json_Events_Into_Transcript()
    {
        var pr = new ProcessResult { ExitCode = 0, DurationMs = 30 };
        var jsonLines = new[]
        {
            """{"type":"text","part":{"type":"text","text":"Reading the report."}}""",
            """{"type":"tool","part":{"type":"tool","tool":"webfetch","state":{"input":{"url":"https://x"}}}}""",
            """{"type":"text","part":{"type":"text","text":" Done."}}""",
        };
        var mock = BuildFakeRunner(pr, ws =>
        {
            File.WriteAllText(Path.Combine(ws, "article.md"), "# A");
            File.WriteAllText(Path.Combine(ws, "result.json"), "{}");
        }, stdoutLines: jsonLines);

        var runner = new OpenCodeRunner(mock.Object, DefaultOpts());
        var result = await runner.RunAsync("my prompt", seedFiles: null, onProgress: null, CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Transcript.Should().Contain("Reading the report.");
        result.Transcript.Should().Contain("🔧");
        result.Transcript.Should().Contain("webfetch");
        result.Transcript.Should().Contain("Done.");
        // Should NOT contain raw JSON braces from original event lines
        result.Transcript.Should().NotContain("{\"type\"");
    }

    // -----------------------------------------------------------------------
    // Calls_OnProgress
    // -----------------------------------------------------------------------
    [Fact]
    public async Task Calls_OnProgress()
    {
        var pr = new ProcessResult { ExitCode = 0, DurationMs = 20 };
        var jsonLines = new[]
        {
            """{"type":"text","part":{"type":"text","text":"Working..."}}""",
        };
        var mock = BuildFakeRunner(pr, ws =>
        {
            File.WriteAllText(Path.Combine(ws, "article.md"), "# A");
        }, stdoutLines: jsonLines);

        var calls = new List<string>();
        var runner = new OpenCodeRunner(mock.Object, DefaultOpts());
        var result = await runner.RunAsync("prompt", seedFiles: null, onProgress: s => calls.Add(s), CancellationToken.None);

        result.Success.Should().BeTrue();
        calls.Should().NotBeEmpty();
        calls.Last().Should().NotBeNullOrWhiteSpace();
    }

    // -----------------------------------------------------------------------
    // Writes_SeedFiles_Into_Workspace
    // -----------------------------------------------------------------------
    [Fact]
    public async Task Writes_SeedFiles_Into_Workspace()
    {
        var pr = new ProcessResult { ExitCode = 0, DurationMs = 10 };
        string? capturedSeedContent = null;

        var mock = new Mock<IProcessRunner>();
        mock.Setup(r => r.RunAsync(It.IsAny<ProcessSpec>(), It.IsAny<CancellationToken>()))
            .Returns<ProcessSpec, CancellationToken>((spec, _) =>
            {
                // Assert seed file exists INSIDE the callback (before workspace is deleted)
                var seedPath = Path.Combine(spec.WorkingDir, "examples", "a.md");
                if (File.Exists(seedPath))
                    capturedSeedContent = File.ReadAllText(seedPath);

                File.WriteAllText(Path.Combine(spec.WorkingDir, "article.md"), "# A");
                return Task.FromResult(pr);
            });

        var runner = new OpenCodeRunner(mock.Object, DefaultOpts());
        var seedFiles = new List<SeedFile> { new("examples/a.md", "# Example") };
        await runner.RunAsync("prompt", seedFiles: seedFiles, onProgress: null, CancellationToken.None);

        capturedSeedContent.Should().Be("# Example");
    }

    // -----------------------------------------------------------------------
    // SeedFile with ".." in path is skipped (path traversal guard)
    // -----------------------------------------------------------------------
    [Fact]
    public async Task SeedFile_PathTraversal_IsSkipped()
    {
        var pr = new ProcessResult { ExitCode = 0, DurationMs = 10 };
        string? capturedWorkingDir = null;

        var mock = new Mock<IProcessRunner>();
        mock.Setup(r => r.RunAsync(It.IsAny<ProcessSpec>(), It.IsAny<CancellationToken>()))
            .Returns<ProcessSpec, CancellationToken>((spec, _) =>
            {
                capturedWorkingDir = spec.WorkingDir;
                File.WriteAllText(Path.Combine(spec.WorkingDir, "article.md"), "# A");
                return Task.FromResult(pr);
            });

        var runner = new OpenCodeRunner(mock.Object, DefaultOpts());
        var seedFiles = new List<SeedFile> { new("../escape.txt", "bad content") };

        // Should not throw, just skip the bad seed file
        var result = await runner.RunAsync("prompt", seedFiles: seedFiles, onProgress: null, CancellationToken.None);

        result.Success.Should().BeTrue();
        // The file should NOT have been written outside the workspace
        if (capturedWorkingDir != null)
        {
            var escapedPath = Path.Combine(Path.GetDirectoryName(capturedWorkingDir)!, "escape.txt");
            File.Exists(escapedPath).Should().BeFalse();
        }
    }
}

// -----------------------------------------------------------------------
// OpenCodeTranscriptFormatterTests
// -----------------------------------------------------------------------
public class OpenCodeTranscriptFormatterTests
{
    [Fact]
    public void Append_TextPart_AppendsText()
    {
        var sb = new StringBuilder();
        OpenCodeTranscriptFormatter.Append(sb, """{"type":"text","part":{"type":"text","text":"Hello world"}}""");
        sb.ToString().Should().Be("Hello world");
    }

    [Fact]
    public void Append_ReasoningPart_AppendsBlockquote()
    {
        var sb = new StringBuilder();
        OpenCodeTranscriptFormatter.Append(sb, """{"type":"reasoning","part":{"type":"reasoning","text":"thinking deeply"}}""");
        var s = sb.ToString();
        s.Should().Contain("💭");
        s.Should().Contain("thinking deeply");
        s.Should().Contain("> ");
    }

    [Fact]
    public void Append_ToolPart_AppendsBoldToolName()
    {
        var sb = new StringBuilder();
        OpenCodeTranscriptFormatter.Append(sb, """{"type":"tool","part":{"type":"tool","tool":"readfile","state":{"input":{"path":"/foo"}}}}""");
        var s = sb.ToString();
        s.Should().Contain("🔧");
        s.Should().Contain("readfile");
        s.Should().Contain("**");
    }

    [Fact]
    public void Append_StepFinish_AppendsTokenInfo()
    {
        var sb = new StringBuilder();
        OpenCodeTranscriptFormatter.Append(sb, """{"type":"step-finish","part":{"type":"step-finish","tokens":{"input":100,"output":50,"total":150}}}""");
        var s = sb.ToString();
        s.Should().Contain("step complete");
        s.Should().Contain("150");
    }

    [Fact]
    public void Append_NonJsonLine_IsIgnoredNoThrow()
    {
        var sb = new StringBuilder();
        // Should not throw and should not append anything
        OpenCodeTranscriptFormatter.Append(sb, "this is not json at all");
        sb.ToString().Should().BeEmpty();
    }

    [Fact]
    public void Append_EmptyLine_IsIgnoredNoThrow()
    {
        var sb = new StringBuilder();
        OpenCodeTranscriptFormatter.Append(sb, "");
        sb.ToString().Should().BeEmpty();
    }

    [Fact]
    public void Append_MultipleLines_AccumulatesText()
    {
        var sb = new StringBuilder();
        OpenCodeTranscriptFormatter.Append(sb, """{"type":"text","part":{"type":"text","text":"First."}}""");
        OpenCodeTranscriptFormatter.Append(sb, """{"type":"text","part":{"type":"text","text":" Second."}}""");
        sb.ToString().Should().Be("First. Second.");
    }

    [Fact]
    public void Append_UnknownPartType_IsIgnored()
    {
        var sb = new StringBuilder();
        OpenCodeTranscriptFormatter.Append(sb, """{"type":"unknown","part":{"type":"step-start"}}""");
        sb.ToString().Should().BeEmpty();
    }
}

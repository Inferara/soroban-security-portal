using AgentIngestionWorker.Api;
using AgentIngestionWorker.OpenCode;
using AgentIngestionWorker.Pdf;
using AgentIngestionWorker.Worker;
using Microsoft.Extensions.Logging.Abstractions;

namespace AgentIngestionWorker.Tests;

public class IngestionRunnerTests
{
    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    /// <summary>
    /// Builds a stub IIngestionPrompt that always returns a fixed PromptBuild.
    /// </summary>
    private static IIngestionPrompt StubPrompt(
        string promptText = "test prompt",
        List<SeedFile>? seedFiles = null)
    {
        var build = new PromptBuild
        {
            PromptText = promptText,
            SeedFiles = seedFiles ?? new List<SeedFile>(),
        };
        var mock = new Mock<IIngestionPrompt>();
        mock.Setup(p => p.BuildAsync(It.IsAny<ClaimedRun>(), It.IsAny<AgentExamplesDto>(), It.IsAny<AgentPromptConfigDto>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(build);
        return mock.Object;
    }

    private static IngestionRunner BuildRunner(
        Mock<IInternalApiClient> api,
        Mock<IOpenCodeRunner> runner,
        IIngestionPrompt? prompt = null)
    {
        // Default prompt-config so tests don't each have to wire it; a test can override afterwards
        // (Moq last-wins) to exercise the config-fetch failure path.
        api.Setup(a => a.GetPromptConfigAsync(It.IsAny<CancellationToken>()))
           .ReturnsAsync(new AgentPromptConfigDto { Preamble = "P", Instructions = "I", ExamplesGuidance = "E" });
        var opts = new IngestionRunnerOptions { PollInterval = TimeSpan.FromMilliseconds(1) };
        var logger = NullLogger<IngestionRunner>.Instance;
        return new IngestionRunner(api.Object, runner.Object, prompt ?? StubPrompt(), opts, logger);
    }

    private static ClaimedRun MakeRun(int id = 5) => new()
    {
        Id = id,
        SourceUrl = "https://example.com/audit.pdf",
        Model = "test-model",
    };

    private static OpenCodeResult SuccessResult(
        string resultJson = "{}",
        string article = "# A") => new()
    {
        Success = true,
        ArticleMarkdown = article,
        ResultJson = resultJson,
        Transcript = "log",
        DurationMs = 100,
    };

    private static AgentExamplesDto MakeExamples() => new()
    {
        Articles = new() { new AgentExampleArticleDto { Title = "Foo", Markdown = "# Foo" } },
        Vulnerabilities = new() { new AgentExampleVulnDto { Title = "Re-entrancy", Severity = "high", Category = 0 } },
        ExistingFindingTitles = new() { "Old Finding" },
    };

    // -------------------------------------------------------------------------
    // ProcessOne_EmptyQueue_ReturnsFalse_NoSubmit
    // -------------------------------------------------------------------------
    [Fact]
    public async Task ProcessOne_EmptyQueue_ReturnsFalse_NoSubmit()
    {
        var api = new Mock<IInternalApiClient>();
        api.Setup(a => a.ClaimNextAsync(It.IsAny<CancellationToken>()))
           .ReturnsAsync((ClaimedRun?)null);

        var runner = new Mock<IOpenCodeRunner>();

        var sut = BuildRunner(api, runner);
        var result = await sut.ProcessOneAsync(CancellationToken.None);

        result.Should().BeFalse();
        api.Verify(a => a.SubmitAsync(It.IsAny<int>(), It.IsAny<SubmitResultDto>(), It.IsAny<CancellationToken>()),
            Times.Never);
        runner.Verify(r => r.RunAsync(It.IsAny<string>(), It.IsAny<IReadOnlyList<SeedFile>?>(), It.IsAny<Action<string>?>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    // -------------------------------------------------------------------------
    // ProcessOne_Success_MapsArticleMetaFindings_AndSubmits
    // -------------------------------------------------------------------------
    [Fact]
    public async Task ProcessOne_Success_MapsArticleMetaFindings_AndSubmits()
    {
        const string resultJson = """
            {
                "reportTitle": "Rozo Audit",
                "protocolName": "Rozo",
                "auditorName": "Hacken",
                "reportDate": "2026-04-13",
                "findings": [{"title":"X","description":"desc","severity":"high","tags":["t"],"category":0}]
            }
            """;

        var run = MakeRun(5);
        var api = new Mock<IInternalApiClient>();
        api.Setup(a => a.ClaimNextAsync(It.IsAny<CancellationToken>())).ReturnsAsync(run);
        api.Setup(a => a.GetExamplesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(MakeExamples());
        api.Setup(a => a.SubmitAsync(It.IsAny<int>(), It.IsAny<SubmitResultDto>(), It.IsAny<CancellationToken>()))
           .Returns(Task.CompletedTask);

        var runner = new Mock<IOpenCodeRunner>();
        runner.Setup(r => r.RunAsync(It.IsAny<string>(), It.IsAny<IReadOnlyList<SeedFile>?>(), It.IsAny<Action<string>?>(), It.IsAny<CancellationToken>()))
              .ReturnsAsync(SuccessResult(resultJson, "# A"));

        SubmitResultDto? captured = null;
        api.Setup(a => a.SubmitAsync(5, It.IsAny<SubmitResultDto>(), It.IsAny<CancellationToken>()))
           .Callback<int, SubmitResultDto, CancellationToken>((_, dto, _) => captured = dto)
           .Returns(Task.CompletedTask);

        var sut = BuildRunner(api, runner);
        var processed = await sut.ProcessOneAsync(CancellationToken.None);

        processed.Should().BeTrue();
        captured.Should().NotBeNull();
        captured!.Success.Should().BeTrue();
        captured.ArticleMarkdown.Should().Be("# A");
        captured.ReportTitle.Should().Be("Rozo Audit");
        captured.ProtocolName.Should().Be("Rozo");
        captured.AuditorName.Should().Be("Hacken");
        captured.ReportDate.Should().NotBeNull();
        captured.ReportDate!.Value.Year.Should().Be(2026);
        captured.ReportDate.Value.Month.Should().Be(4);
        captured.ReportDate.Value.Day.Should().Be(13);
        captured.FindingsJson.Should().Contain("\"title\":\"X\"");
    }

    private static SubmitResultDto? RunAndCapture(string sourceUrl, string resultJson)
    {
        var run = new ClaimedRun { Id = 5, SourceUrl = sourceUrl, Model = "m" };
        var api = new Mock<IInternalApiClient>();
        api.Setup(a => a.ClaimNextAsync(It.IsAny<CancellationToken>())).ReturnsAsync(run);
        api.Setup(a => a.GetExamplesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(new AgentExamplesDto());
        SubmitResultDto? captured = null;
        api.Setup(a => a.SubmitAsync(5, It.IsAny<SubmitResultDto>(), It.IsAny<CancellationToken>()))
           .Callback<int, SubmitResultDto, CancellationToken>((_, dto, _) => captured = dto)
           .Returns(Task.CompletedTask);
        var runner = new Mock<IOpenCodeRunner>();
        runner.Setup(r => r.RunAsync(It.IsAny<string>(), It.IsAny<IReadOnlyList<SeedFile>?>(), It.IsAny<Action<string>?>(), It.IsAny<CancellationToken>()))
              .ReturnsAsync(SuccessResult(resultJson));
        BuildRunner(api, runner).ProcessOneAsync(CancellationToken.None).GetAwaiter().GetResult();
        return captured;
    }

    [Fact]
    public void ProcessOne_PdfSource_DefaultsReportPdfUrl_ToSource_WhenAgentOmitsIt()
    {
        // Source IS a PDF and the agent left reportPdfUrl empty → default to the source so the original
        // document is still captured on approve.
        var captured = RunAndCapture("https://example.com/audit.pdf", "{\"reportTitle\":\"T\",\"findings\":[]}");
        captured!.ReportPdfUrl.Should().Be("https://example.com/audit.pdf");
    }

    [Fact]
    public void ProcessOne_PdfSource_KeepsAgentReportPdfUrl_WhenProvided()
    {
        var captured = RunAndCapture("https://example.com/audit.pdf",
            "{\"reportTitle\":\"T\",\"reportPdfUrl\":\"https://cdn/real.pdf\",\"findings\":[]}");
        captured!.ReportPdfUrl.Should().Be("https://cdn/real.pdf");
    }

    [Fact]
    public void ProcessOne_NonPdfSource_LeavesReportPdfUrlEmpty_WhenAgentOmitsIt()
    {
        var captured = RunAndCapture("https://example.com/audit-page", "{\"reportTitle\":\"T\",\"findings\":[]}");
        captured!.ReportPdfUrl.Should().BeNullOrEmpty();
    }

    // -------------------------------------------------------------------------
    // ProcessOne_RunnerReceivesSeedFilesAndNonNullProgress
    // -------------------------------------------------------------------------
    [Fact]
    public async Task ProcessOne_RunnerReceivesSeedFilesAndNonNullProgress()
    {
        var seeds = new List<SeedFile>
        {
            new("examples/articles/00-foo.md", "# Foo"),
            new("examples/vulnerabilities.json", "[]"),
        };

        var run = MakeRun(5);
        var api = new Mock<IInternalApiClient>();
        api.Setup(a => a.ClaimNextAsync(It.IsAny<CancellationToken>())).ReturnsAsync(run);
        api.Setup(a => a.GetExamplesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(MakeExamples());
        api.Setup(a => a.SubmitAsync(It.IsAny<int>(), It.IsAny<SubmitResultDto>(), It.IsAny<CancellationToken>()))
           .Returns(Task.CompletedTask);

        IReadOnlyList<SeedFile>? capturedSeeds = null;
        Action<string>? capturedProgress = null;

        var runner = new Mock<IOpenCodeRunner>();
        runner.Setup(r => r.RunAsync(
                It.IsAny<string>(),
                It.IsAny<IReadOnlyList<SeedFile>?>(),
                It.IsAny<Action<string>?>(),
                It.IsAny<CancellationToken>()))
              .Callback<string, IReadOnlyList<SeedFile>?, Action<string>?, CancellationToken>(
                  (_, sf, op, _) =>
                  {
                      capturedSeeds = sf;
                      capturedProgress = op;
                  })
              .ReturnsAsync(SuccessResult());

        var sut = BuildRunner(api, runner, StubPrompt("prompt", seeds));
        await sut.ProcessOneAsync(CancellationToken.None);

        // Runner received the 2 seed files from the PromptBuild
        capturedSeeds.Should().NotBeNull();
        capturedSeeds!.Count.Should().Be(2);
        // onProgress must be non-null
        capturedProgress.Should().NotBeNull();
    }

    // -------------------------------------------------------------------------
    // ProcessOne_GetExamplesFailure_StillProcesses
    // -------------------------------------------------------------------------
    [Fact]
    public async Task ProcessOne_GetExamplesFailure_StillProcesses()
    {
        var run = MakeRun(5);
        var api = new Mock<IInternalApiClient>();
        api.Setup(a => a.ClaimNextAsync(It.IsAny<CancellationToken>())).ReturnsAsync(run);
        api.Setup(a => a.GetExamplesAsync(It.IsAny<CancellationToken>()))
           .ThrowsAsync(new HttpRequestException("backend down"));
        api.Setup(a => a.SubmitAsync(It.IsAny<int>(), It.IsAny<SubmitResultDto>(), It.IsAny<CancellationToken>()))
           .Returns(Task.CompletedTask);

        var runner = new Mock<IOpenCodeRunner>();
        runner.Setup(r => r.RunAsync(It.IsAny<string>(), It.IsAny<IReadOnlyList<SeedFile>?>(), It.IsAny<Action<string>?>(), It.IsAny<CancellationToken>()))
              .ReturnsAsync(SuccessResult());

        SubmitResultDto? captured = null;
        api.Setup(a => a.SubmitAsync(5, It.IsAny<SubmitResultDto>(), It.IsAny<CancellationToken>()))
           .Callback<int, SubmitResultDto, CancellationToken>((_, dto, _) => captured = dto)
           .Returns(Task.CompletedTask);

        var sut = BuildRunner(api, runner);
        var processed = await sut.ProcessOneAsync(CancellationToken.None);

        // Run still completes successfully despite GetExamples failure
        processed.Should().BeTrue();
        captured.Should().NotBeNull();
        captured!.Success.Should().BeTrue();
    }

    // -------------------------------------------------------------------------
    // ProcessOne_OnProgress_CallsProgressAsync
    // -------------------------------------------------------------------------
    [Fact]
    public async Task ProcessOne_OnProgress_CallsProgressAsync()
    {
        var run = MakeRun(42);
        var api = new Mock<IInternalApiClient>();
        api.Setup(a => a.ClaimNextAsync(It.IsAny<CancellationToken>())).ReturnsAsync(run);
        api.Setup(a => a.GetExamplesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(new AgentExamplesDto());
        api.Setup(a => a.SubmitAsync(It.IsAny<int>(), It.IsAny<SubmitResultDto>(), It.IsAny<CancellationToken>()))
           .Returns(Task.CompletedTask);
        api.Setup(a => a.ProgressAsync(It.IsAny<int>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
           .Returns(Task.CompletedTask);

        Action<string>? capturedProgress = null;

        var runner = new Mock<IOpenCodeRunner>();
        runner.Setup(r => r.RunAsync(
                It.IsAny<string>(),
                It.IsAny<IReadOnlyList<SeedFile>?>(),
                It.IsAny<Action<string>?>(),
                It.IsAny<CancellationToken>()))
              .Callback<string, IReadOnlyList<SeedFile>?, Action<string>?, CancellationToken>(
                  (_, _, op, _) => capturedProgress = op)
              .ReturnsAsync(SuccessResult());

        var sut = BuildRunner(api, runner);
        await sut.ProcessOneAsync(CancellationToken.None);

        capturedProgress.Should().NotBeNull();
        // Invoke the captured progress callback
        capturedProgress!("some transcript line");

        // Allow fire-and-forget task to complete
        await Task.Delay(50);

        api.Verify(a => a.ProgressAsync(42, "some transcript line", It.IsAny<CancellationToken>()), Times.Once);
    }

    // -------------------------------------------------------------------------
    // ProcessOne_RunnerFailure_SubmitsFailed
    // -------------------------------------------------------------------------
    [Fact]
    public async Task ProcessOne_RunnerFailure_SubmitsFailed()
    {
        var run = MakeRun(7);
        var api = new Mock<IInternalApiClient>();
        api.Setup(a => a.ClaimNextAsync(It.IsAny<CancellationToken>())).ReturnsAsync(run);
        api.Setup(a => a.GetExamplesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(new AgentExamplesDto());

        SubmitResultDto? captured = null;
        api.Setup(a => a.SubmitAsync(7, It.IsAny<SubmitResultDto>(), It.IsAny<CancellationToken>()))
           .Callback<int, SubmitResultDto, CancellationToken>((_, dto, _) => captured = dto)
           .Returns(Task.CompletedTask);

        var runner = new Mock<IOpenCodeRunner>();
        runner.Setup(r => r.RunAsync(It.IsAny<string>(), It.IsAny<IReadOnlyList<SeedFile>?>(), It.IsAny<Action<string>?>(), It.IsAny<CancellationToken>()))
              .ReturnsAsync(new OpenCodeResult { Success = false, Error = "timeout", DurationMs = 9000 });

        var sut = BuildRunner(api, runner);
        await sut.ProcessOneAsync(CancellationToken.None);

        captured.Should().NotBeNull();
        captured!.Success.Should().BeFalse();
        captured.Error.Should().Be("timeout");
    }

    // -------------------------------------------------------------------------
    // ProcessOne_MalformedResultJson_SubmitsEmptyFindings
    // -------------------------------------------------------------------------
    [Fact]
    public async Task ProcessOne_MalformedResultJson_SubmitsEmptyFindings()
    {
        var run = MakeRun(3);
        var api = new Mock<IInternalApiClient>();
        api.Setup(a => a.ClaimNextAsync(It.IsAny<CancellationToken>())).ReturnsAsync(run);
        api.Setup(a => a.GetExamplesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(new AgentExamplesDto());

        SubmitResultDto? captured = null;
        api.Setup(a => a.SubmitAsync(3, It.IsAny<SubmitResultDto>(), It.IsAny<CancellationToken>()))
           .Callback<int, SubmitResultDto, CancellationToken>((_, dto, _) => captured = dto)
           .Returns(Task.CompletedTask);

        var runner = new Mock<IOpenCodeRunner>();
        runner.Setup(r => r.RunAsync(It.IsAny<string>(), It.IsAny<IReadOnlyList<SeedFile>?>(), It.IsAny<Action<string>?>(), It.IsAny<CancellationToken>()))
              .ReturnsAsync(SuccessResult("{not json", "# Broken"));

        var sut = BuildRunner(api, runner);
        await sut.ProcessOneAsync(CancellationToken.None);

        captured.Should().NotBeNull();
        captured!.FindingsJson.Should().Be("[]");
        captured.Error.Should().NotBeNullOrWhiteSpace();
        captured.Error.Should().Contain("JSON");
    }

    // -------------------------------------------------------------------------
    // ProcessOne_RunnerThrows_SubmitsFailed
    // -------------------------------------------------------------------------
    [Fact]
    public async Task ProcessOne_RunnerThrows_SubmitsFailed()
    {
        var run = MakeRun(9);
        var api = new Mock<IInternalApiClient>();
        api.Setup(a => a.ClaimNextAsync(It.IsAny<CancellationToken>())).ReturnsAsync(run);
        api.Setup(a => a.GetExamplesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(new AgentExamplesDto());

        SubmitResultDto? captured = null;
        api.Setup(a => a.SubmitAsync(9, It.IsAny<SubmitResultDto>(), It.IsAny<CancellationToken>()))
           .Callback<int, SubmitResultDto, CancellationToken>((_, dto, _) => captured = dto)
           .Returns(Task.CompletedTask);

        var runner = new Mock<IOpenCodeRunner>();
        runner.Setup(r => r.RunAsync(It.IsAny<string>(), It.IsAny<IReadOnlyList<SeedFile>?>(), It.IsAny<Action<string>?>(), It.IsAny<CancellationToken>()))
              .ThrowsAsync(new InvalidOperationException("network error"));

        var sut = BuildRunner(api, runner);
        await sut.ProcessOneAsync(CancellationToken.None);

        captured.Should().NotBeNull();
        captured!.Success.Should().BeFalse();
        captured.Error.Should().Contain("network error");
    }

    // -------------------------------------------------------------------------
    // ProcessOne_PromptConfigFailure_SubmitsFailed_WithoutRunning
    // -------------------------------------------------------------------------
    [Fact]
    public async Task ProcessOne_PromptConfigFailure_SubmitsFailed_WithoutRunning()
    {
        var run = MakeRun(11);
        var api = new Mock<IInternalApiClient>();
        api.Setup(a => a.ClaimNextAsync(It.IsAny<CancellationToken>())).ReturnsAsync(run);
        api.Setup(a => a.GetExamplesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(new AgentExamplesDto());

        SubmitResultDto? captured = null;
        api.Setup(a => a.SubmitAsync(11, It.IsAny<SubmitResultDto>(), It.IsAny<CancellationToken>()))
           .Callback<int, SubmitResultDto, CancellationToken>((_, dto, _) => captured = dto)
           .Returns(Task.CompletedTask);

        var runner = new Mock<IOpenCodeRunner>();

        var sut = BuildRunner(api, runner);
        // Override the default so the prompt-config fetch fails (e.g. API unreachable).
        api.Setup(a => a.GetPromptConfigAsync(It.IsAny<CancellationToken>()))
           .ThrowsAsync(new HttpRequestException("api down"));

        var processed = await sut.ProcessOneAsync(CancellationToken.None);

        processed.Should().BeTrue();
        captured.Should().NotBeNull();
        captured!.Success.Should().BeFalse();
        captured.Error.Should().Contain("prompt configuration");
        // opencode must NOT run when we couldn't load the prompt
        runner.Verify(r => r.RunAsync(It.IsAny<string>(), It.IsAny<IReadOnlyList<SeedFile>?>(), It.IsAny<Action<string>?>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    // -------------------------------------------------------------------------
    // MapToSubmit unit tests
    // -------------------------------------------------------------------------

    [Fact]
    public void MapToSubmit_FullResultJson_MapsAllFields()
    {
        const string json = """
            {
                "reportTitle": "My Report",
                "protocolName": "MyProto",
                "auditorName": "Sec Corp",
                "reportDate": "2025-12-01",
                "findings": [
                    {"title":"Reentrancy","description":"desc","severity":"critical","tags":["defi"],"category":0}
                ]
            }
            """;

        var result = new OpenCodeResult
        {
            Success = true,
            ArticleMarkdown = "# My Report",
            ResultJson = json,
            Transcript = "t",
            DurationMs = 200,
        };

        var dto = IngestionRunner.MapToSubmit(result);

        dto.Success.Should().BeTrue();
        dto.ArticleMarkdown.Should().Be("# My Report");
        dto.ReportTitle.Should().Be("My Report");
        dto.ProtocolName.Should().Be("MyProto");
        dto.AuditorName.Should().Be("Sec Corp");
        dto.ReportDate.Should().NotBeNull();
        dto.ReportDate!.Value.Year.Should().Be(2025);
        dto.FindingsJson.Should().Contain("Reentrancy");
        dto.Error.Should().BeNull();
    }

    [Fact]
    public void MapToSubmit_EmptyFindings_ReturnsEmptyArray()
    {
        const string json = """{"reportTitle":"T","protocolName":"P","auditorName":"A","findings":[]}""";

        var result = new OpenCodeResult
        {
            Success = true,
            ResultJson = json,
            DurationMs = 50,
        };

        var dto = IngestionRunner.MapToSubmit(result);

        dto.Success.Should().BeTrue();
        dto.FindingsJson.Should().Be("[]");
        dto.ReportTitle.Should().Be("T");
    }

    [Fact]
    public void MapToSubmit_MalformedJson_SetsEmptyFindingsAndError()
    {
        var result = new OpenCodeResult
        {
            Success = true,
            ResultJson = "{this is not json!!!",
            DurationMs = 30,
        };

        var dto = IngestionRunner.MapToSubmit(result);

        dto.FindingsJson.Should().Be("[]");
        dto.Error.Should().NotBeNullOrWhiteSpace();
        dto.Error.Should().Contain("JSON");
    }

    [Fact]
    public void MapToSubmit_NotSuccess_ReturnsWithoutParsingJson()
    {
        var result = new OpenCodeResult
        {
            Success = false,
            Error = "timed out",
            ResultJson = "{malformed",
            DurationMs = 60,
        };

        var dto = IngestionRunner.MapToSubmit(result);

        dto.Success.Should().BeFalse();
        dto.Error.Should().Be("timed out");
        // No JSON parsing attempted — FindingsJson should be null
        dto.FindingsJson.Should().BeNull();
    }

    [Fact]
    public void MapToSubmit_WithReportPdfUrl_MapsField()
    {
        const string json = """
            {
                "reportTitle": "My Report",
                "protocolName": "MyProto",
                "auditorName": "Sec Corp",
                "reportPdfUrl": "https://x/report.pdf",
                "findings": []
            }
            """;

        var result = new OpenCodeResult
        {
            Success = true,
            ResultJson = json,
            DurationMs = 10,
        };

        var dto = IngestionRunner.MapToSubmit(result);

        dto.ReportPdfUrl.Should().Be("https://x/report.pdf");
    }

    [Fact]
    public void MapToSubmit_AbsentReportPdfUrl_IsNull()
    {
        const string json = """
            {
                "reportTitle": "My Report",
                "protocolName": "MyProto",
                "auditorName": "Sec Corp",
                "findings": []
            }
            """;

        var result = new OpenCodeResult
        {
            Success = true,
            ResultJson = json,
            DurationMs = 10,
        };

        var dto = IngestionRunner.MapToSubmit(result);

        dto.ReportPdfUrl.Should().BeNull();
    }

    [Fact]
    public void MapToSubmit_NullReportDate_LeavesReportDateNull()
    {
        const string json = """{"reportTitle":"T","protocolName":"P","auditorName":"A","reportDate":null,"findings":[]}""";

        var result = new OpenCodeResult { Success = true, ResultJson = json, DurationMs = 10 };
        var dto = IngestionRunner.MapToSubmit(result);

        dto.ReportDate.Should().BeNull();
    }

    [Fact]
    public void MapToSubmit_EmptyResultJson_ReturnsSuccessWithNullMetaAndEmptyFindings()
    {
        var result = new OpenCodeResult
        {
            Success = true,
            ArticleMarkdown = "# A",
            ResultJson = "",
            DurationMs = 10,
        };

        var dto = IngestionRunner.MapToSubmit(result);

        dto.Success.Should().BeTrue();
        dto.ReportTitle.Should().BeNull();
        dto.ProtocolName.Should().BeNull();
        dto.AuditorName.Should().BeNull();
        dto.ReportDate.Should().BeNull();
        // No "findings" key in empty object "{}" — falls back to "[]"
        dto.FindingsJson.Should().Be("[]");
    }
}

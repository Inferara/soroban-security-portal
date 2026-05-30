using AgentIngestionWorker.Api;
using AgentIngestionWorker.OpenCode;
using AgentIngestionWorker.Worker;
using Microsoft.Extensions.Logging.Abstractions;

namespace AgentIngestionWorker.Tests;

public class IngestionRunnerTests
{
    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------
    private static IngestionRunner BuildRunner(
        Mock<IInternalApiClient> api,
        Mock<IOpenCodeRunner> runner,
        IIngestionPrompt? prompt = null)
    {
        var opts = new IngestionRunnerOptions { PollInterval = TimeSpan.FromMilliseconds(1) };
        var logger = NullLogger<IngestionRunner>.Instance;
        return new IngestionRunner(api.Object, runner.Object, prompt ?? new IngestionPrompt(), opts, logger);
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
        runner.Verify(r => r.RunAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()),
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
        api.Setup(a => a.SubmitAsync(It.IsAny<int>(), It.IsAny<SubmitResultDto>(), It.IsAny<CancellationToken>()))
           .Returns(Task.CompletedTask);

        var runner = new Mock<IOpenCodeRunner>();
        runner.Setup(r => r.RunAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
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

    // -------------------------------------------------------------------------
    // ProcessOne_RunnerFailure_SubmitsFailed
    // -------------------------------------------------------------------------
    [Fact]
    public async Task ProcessOne_RunnerFailure_SubmitsFailed()
    {
        var run = MakeRun(7);
        var api = new Mock<IInternalApiClient>();
        api.Setup(a => a.ClaimNextAsync(It.IsAny<CancellationToken>())).ReturnsAsync(run);

        SubmitResultDto? captured = null;
        api.Setup(a => a.SubmitAsync(7, It.IsAny<SubmitResultDto>(), It.IsAny<CancellationToken>()))
           .Callback<int, SubmitResultDto, CancellationToken>((_, dto, _) => captured = dto)
           .Returns(Task.CompletedTask);

        var runner = new Mock<IOpenCodeRunner>();
        runner.Setup(r => r.RunAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
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

        SubmitResultDto? captured = null;
        api.Setup(a => a.SubmitAsync(3, It.IsAny<SubmitResultDto>(), It.IsAny<CancellationToken>()))
           .Callback<int, SubmitResultDto, CancellationToken>((_, dto, _) => captured = dto)
           .Returns(Task.CompletedTask);

        var runner = new Mock<IOpenCodeRunner>();
        runner.Setup(r => r.RunAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
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

        SubmitResultDto? captured = null;
        api.Setup(a => a.SubmitAsync(9, It.IsAny<SubmitResultDto>(), It.IsAny<CancellationToken>()))
           .Callback<int, SubmitResultDto, CancellationToken>((_, dto, _) => captured = dto)
           .Returns(Task.CompletedTask);

        var runner = new Mock<IOpenCodeRunner>();
        runner.Setup(r => r.RunAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
              .ThrowsAsync(new InvalidOperationException("network error"));

        var sut = BuildRunner(api, runner);
        await sut.ProcessOneAsync(CancellationToken.None);

        captured.Should().NotBeNull();
        captured!.Success.Should().BeFalse();
        captured.Error.Should().Contain("network error");
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

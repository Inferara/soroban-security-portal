using System.Net;
using System.Text.Json;
using AgentIngestionWorker.Api;
using AgentIngestionWorker.Pdf;
using AgentIngestionWorker.Worker;

namespace AgentIngestionWorker.Tests;

/// <summary>
/// Tests for IngestionPrompt.BuildAsync — the prompt TEXT now comes from AgentPromptConfigDto (served by
/// the API from Admin Settings); this class only verifies the mechanical composition, the PDF source-file
/// handling, and the seed files. (The canonical prompt content is covered by API-side tests.)
/// </summary>
public class IngestionPromptTests
{
    // Synthetic config with recognizable markers so we can assert the blocks land in the right place.
    private static AgentPromptConfigDto Cfg() => new()
    {
        Preamble = "PREAMBLE_MARKER (untrusted DATA)",
        Instructions = "INSTRUCTIONS_MARKER — article.md + result.json with findings",
        ExamplesGuidance = "EXAMPLES_GUIDANCE_MARKER (de-duplication)",
    };

    private static HttpClient MakeHttpClient(byte[]? responseBytes = null, HttpStatusCode status = HttpStatusCode.OK)
    {
        var handler = new StubHttpMessageHandler(responseBytes ?? Array.Empty<byte>(), status);
        return new HttpClient(handler);
    }

    private static ClaimedRun MakeRun(string url) => new() { Id = 1, SourceUrl = url, Model = "test" };

    private static AgentExamplesDto EmptyExamples() => new();

    private static AgentExamplesDto RichExamples() => new()
    {
        Articles = new()
        {
            new AgentExampleArticleDto { Title = "My First Audit", Markdown = "# My First Audit\ncontent" },
            new AgentExampleArticleDto { Title = "Second Report Here", Markdown = "# Second Report\ncontent2" },
        },
        Vulnerabilities = new()
        {
            new AgentExampleVulnDto
            {
                Title = "Reentrancy Attack",
                Severity = "high",
                Category = 0,
                Tags = new List<string> { "defi", "reentrancy" },
                Description = "Reentrancy vulnerability."
            },
        },
        ExistingFindingTitles = new() { "Old Finding One", "Old Finding Two" },
        ExistingReportTitles = new() { "Existing Report A", "Existing Report B" },
    };

    // -------------------------------------------------------------------------
    // URL branch — no download, composes preamble + fetch line + instructions
    // -------------------------------------------------------------------------
    [Fact]
    public async Task NonPdf_Url_ComposesPrompt_NoDownload()
    {
        const string url = "https://x/report";
        var extractorMock = new Mock<IPdfTextExtractor>();
        var handler = new TrackingHttpMessageHandler();
        var http = new HttpClient(handler);

        var sut = new IngestionPrompt(http, extractorMock.Object);
        var build = await sut.BuildAsync(MakeRun(url), EmptyExamples(), Cfg(), CancellationToken.None);

        build.PromptText.Should().Contain(url);
        build.PromptText.Should().Contain("Fetch and read the audit report at:");
        build.PromptText.Should().Contain("PREAMBLE_MARKER (untrusted DATA)");
        build.PromptText.Should().Contain("INSTRUCTIONS_MARKER");
        build.PromptText.Should().Contain("result.json");
        build.PromptText.Should().NotContain("Do NOT fetch any URL");
        handler.RequestCount.Should().Be(0);
        extractorMock.Verify(e => e.ExtractText(It.IsAny<byte[]>()), Times.Never);
        build.SeedFiles.Should().BeEmpty();
    }

    // -------------------------------------------------------------------------
    // PDF branch — text goes into a workspace file, prompt references it (CLI-length safe)
    // -------------------------------------------------------------------------
    [Fact]
    public async Task Pdf_Url_WritesSourceFile_AndReferencesIt()
    {
        const string url = "https://x/report.pdf";
        var pdfBytes = new byte[] { 0x25, 0x50, 0x44, 0x46 };
        const string extractedText = "EXTRACTED REPORT TEXT";

        var extractorMock = new Mock<IPdfTextExtractor>();
        extractorMock.Setup(e => e.ExtractText(It.IsAny<byte[]>())).Returns(extractedText);

        var http = MakeHttpClient(pdfBytes);
        var sut = new IngestionPrompt(http, extractorMock.Object);
        var build = await sut.BuildAsync(MakeRun(url), EmptyExamples(), Cfg(), CancellationToken.None);

        var sourceSeed = build.SeedFiles.Should().ContainSingle(sf => sf.RelativePath == "source/report.txt").Subject;
        sourceSeed.Content.Should().Be(extractedText);
        build.PromptText.Should().Contain("source/report.txt");
        build.PromptText.Should().Contain("Do NOT fetch any URL");
        build.PromptText.Should().Contain("PREAMBLE_MARKER (untrusted DATA)");
        build.PromptText.Should().Contain("INSTRUCTIONS_MARKER");
        build.PromptText.Should().NotContain(extractedText);                         // text is in the file, not inlined
        build.PromptText.Should().NotContain($"Fetch and read the audit report at: {url}");
        extractorMock.Verify(e => e.ExtractText(It.IsAny<byte[]>()), Times.Once);
    }

    [Fact]
    public async Task Pdf_Url_WithQueryString_StillDetectedAsPdf()
    {
        const string url = "https://x/report.pdf?token=abc";
        var extractorMock = new Mock<IPdfTextExtractor>();
        extractorMock.Setup(e => e.ExtractText(It.IsAny<byte[]>())).Returns("REPORT CONTENT");

        var http = MakeHttpClient(new byte[] { 0x25, 0x50, 0x44, 0x46 });
        var sut = new IngestionPrompt(http, extractorMock.Object);
        var build = await sut.BuildAsync(MakeRun(url), EmptyExamples(), Cfg(), CancellationToken.None);

        build.SeedFiles.Should().Contain(sf => sf.RelativePath == "source/report.txt" && sf.Content == "REPORT CONTENT");
        build.PromptText.Should().Contain("Do NOT fetch any URL");
    }

    [Fact]
    public async Task Pdf_ExtractEmpty_FallsBackToUrlPrompt()
    {
        const string url = "https://x/report.pdf";
        var extractorMock = new Mock<IPdfTextExtractor>();
        extractorMock.Setup(e => e.ExtractText(It.IsAny<byte[]>())).Returns(""); // empty

        var http = MakeHttpClient(new byte[] { 0x25, 0x50, 0x44, 0x46 });
        var sut = new IngestionPrompt(http, extractorMock.Object);
        var build = await sut.BuildAsync(MakeRun(url), EmptyExamples(), Cfg(), CancellationToken.None);

        build.PromptText.Should().Contain(url);
        build.PromptText.Should().Contain("Fetch and read the audit report at:");
        build.PromptText.Should().NotContain("Do NOT fetch any URL");
        build.SeedFiles.Should().NotContain(sf => sf.RelativePath == "source/report.txt");
    }

    [Theory]
    [InlineData("https://example.com/report.pdf", true)]
    [InlineData("https://example.com/report.PDF", true)]
    [InlineData("https://example.com/report.pdf?token=abc", true)]
    [InlineData("https://example.com/report.pdf#section", true)]
    [InlineData("https://example.com/report", false)]
    [InlineData("https://example.com/report.html", false)]
    [InlineData("https://example.com/report.pdf.zip", false)]
    [InlineData("", false)]
    public void IsPdfUrl_DetectionIsCorrect(string url, bool expected)
    {
        IngestionPrompt.IsPdfUrl(url).Should().Be(expected);
    }

    // -------------------------------------------------------------------------
    // Examples / de-duplication guidance (configurable) appended only when examples exist
    // -------------------------------------------------------------------------
    [Fact]
    public async Task ExamplesPresent_AppendsExamplesGuidance_AndBuildsSeedFiles()
    {
        const string url = "https://x/report";
        var sut = new IngestionPrompt(MakeHttpClient(), new Mock<IPdfTextExtractor>().Object);

        var build = await sut.BuildAsync(MakeRun(url), RichExamples(), Cfg(), CancellationToken.None);

        // Guidance block from config is appended.
        build.PromptText.Should().Contain("EXAMPLES_GUIDANCE_MARKER (de-duplication)");

        // 2 articles + vulnerabilities.json + existing-finding-titles.txt + existing-report-titles.txt = 5
        build.SeedFiles.Should().HaveCount(5);
        build.SeedFiles.Should().Contain(sf => sf.RelativePath == "examples/articles/00-my-first-audit.md");
        build.SeedFiles.Should().Contain(sf => sf.RelativePath == "examples/articles/01-second-report-here.md");
        var vulnSeed = build.SeedFiles.First(sf => sf.RelativePath == "examples/vulnerabilities.json");
        var parsed = JsonSerializer.Deserialize<List<AgentExampleVulnDto>>(vulnSeed.Content,
            new JsonSerializerOptions(JsonSerializerDefaults.Web));
        parsed!.Should().ContainSingle(v => v.Title == "Reentrancy Attack");
        build.SeedFiles.First(sf => sf.RelativePath == "examples/existing-finding-titles.txt")
            .Content.Should().Be("Old Finding One\nOld Finding Two");
        build.SeedFiles.First(sf => sf.RelativePath == "examples/existing-report-titles.txt")
            .Content.Should().Be("Existing Report A\nExisting Report B");
    }

    [Fact]
    public async Task EmptyExamples_NoSeedFiles_AndNoExamplesGuidance()
    {
        const string url = "https://x/report";
        var sut = new IngestionPrompt(MakeHttpClient(), new Mock<IPdfTextExtractor>().Object);

        var build = await sut.BuildAsync(MakeRun(url), EmptyExamples(), Cfg(), CancellationToken.None);

        build.SeedFiles.Should().BeEmpty();
        build.PromptText.Should().NotContain("EXAMPLES_GUIDANCE_MARKER");
    }

    // -------------------------------------------------------------------------
    // Slug helper
    // -------------------------------------------------------------------------
    [Theory]
    [InlineData("My First Audit", "my-first-audit")]
    [InlineData("Second Report Here", "second-report-here")]
    [InlineData("", "article")]
    [InlineData("   ", "article")]
    [InlineData("A B C D E F G H I J K L M N O P Q R S T U V W X Y Z", "a-b-c-d-e-f-g-h-i-j-k-l-m-n-o-p-q-r-s-t")]
    public void Slug_ProducesCorrectOutput(string title, string expectedPrefix)
    {
        var result = IngestionPrompt.Slug(title);
        result.Should().StartWith(expectedPrefix.Length > 40 ? expectedPrefix[..40] : expectedPrefix);
        result.Length.Should().BeLessThanOrEqualTo(40);
    }
}

// -------------------------------------------------------------------------
// Test infrastructure: stub HTTP handlers
// -------------------------------------------------------------------------

internal sealed class StubHttpMessageHandler : HttpMessageHandler
{
    private readonly byte[] _responseBytes;
    private readonly HttpStatusCode _status;

    public StubHttpMessageHandler(byte[] responseBytes, HttpStatusCode status = HttpStatusCode.OK)
    {
        _responseBytes = responseBytes;
        _status = status;
    }

    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var response = new HttpResponseMessage(_status)
        {
            Content = new ByteArrayContent(_responseBytes),
        };
        return Task.FromResult(response);
    }
}

internal sealed class TrackingHttpMessageHandler : HttpMessageHandler
{
    public int RequestCount { get; private set; }

    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        RequestCount++;
        return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new ByteArrayContent(Array.Empty<byte>()),
        });
    }
}

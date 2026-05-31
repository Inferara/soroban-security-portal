using System.Net;
using System.Text.Json;
using AgentIngestionWorker.Api;
using AgentIngestionWorker.Pdf;
using AgentIngestionWorker.Worker;

namespace AgentIngestionWorker.Tests;

/// <summary>
/// Tests for IngestionPrompt.BuildAsync and the IsPdfUrl helper.
/// All HTTP and PDF extraction are mocked — no real network or file I/O.
/// </summary>
public class IngestionPromptTests
{
    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    /// <summary>
    /// Creates an HttpClient backed by a stub handler that returns a fixed
    /// response for any request.
    /// </summary>
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
    // NonPdf_Url_PromptContainsUrl_NoDownload (empty examples)
    // -------------------------------------------------------------------------
    [Fact]
    public async Task NonPdf_Url_PromptContainsUrl_NoDownload()
    {
        const string url = "https://x/report";
        var extractorMock = new Mock<IPdfTextExtractor>();
        var handler = new TrackingHttpMessageHandler();
        var http = new HttpClient(handler);

        var sut = new IngestionPrompt(http, extractorMock.Object);
        var build = await sut.BuildAsync(MakeRun(url), EmptyExamples(), CancellationToken.None);

        // Prompt must contain the URL
        build.PromptText.Should().Contain(url);
        // Schema must be present in both branches
        build.PromptText.Should().Contain("result.json");
        build.PromptText.Should().Contain("findings");
        // No HTTP call should have been made
        handler.RequestCount.Should().Be(0);
        // Extractor must never have been called
        extractorMock.Verify(e => e.ExtractText(It.IsAny<byte[]>()), Times.Never);
        // Empty examples → no seed files
        build.SeedFiles.Should().BeEmpty();
    }

    // -------------------------------------------------------------------------
    // Pdf_Url_DownloadsAndEmbedsExtractedText (empty examples)
    // -------------------------------------------------------------------------
    [Fact]
    public async Task Pdf_Url_DownloadsAndEmbedsExtractedText()
    {
        const string url = "https://x/report.pdf";
        var pdfBytes = new byte[] { 0x25, 0x50, 0x44, 0x46 }; // %PDF magic bytes
        const string extractedText = "EXTRACTED TEXT";

        var extractorMock = new Mock<IPdfTextExtractor>();
        extractorMock.Setup(e => e.ExtractText(It.IsAny<byte[]>())).Returns(extractedText);

        var http = MakeHttpClient(pdfBytes);
        var sut = new IngestionPrompt(http, extractorMock.Object);
        var build = await sut.BuildAsync(MakeRun(url), EmptyExamples(), CancellationToken.None);

        // The extracted text goes into a workspace FILE (not inlined — that would blow the CLI length
        // limit for a real PDF). The prompt references the file and forbids fetching.
        var sourceSeed = build.SeedFiles.Should().ContainSingle(sf => sf.RelativePath == "source/report.txt").Subject;
        sourceSeed.Content.Should().Be(extractedText);
        build.PromptText.Should().Contain("source/report.txt");
        build.PromptText.Should().NotContain(extractedText);
        // Must NOT instruct the agent to fetch the PDF URL
        build.PromptText.Should().NotContain($"Fetch and read the audit report at: {url}");
        // Must tell the agent NOT to fetch a URL
        build.PromptText.Should().Contain("Do NOT fetch any URL");
        // Schema must be present
        build.PromptText.Should().Contain("result.json");
        build.PromptText.Should().Contain("findings");
        // Extractor was called once
        extractorMock.Verify(e => e.ExtractText(It.IsAny<byte[]>()), Times.Once);
    }

    // -------------------------------------------------------------------------
    // Pdf_Url_WithQueryString_StillDetectedAsPdf
    // -------------------------------------------------------------------------
    [Fact]
    public async Task Pdf_Url_WithQueryString_StillDetectedAsPdf()
    {
        const string url = "https://x/report.pdf?token=abc";
        const string extractedText = "REPORT CONTENT";

        var extractorMock = new Mock<IPdfTextExtractor>();
        extractorMock.Setup(e => e.ExtractText(It.IsAny<byte[]>())).Returns(extractedText);

        var http = MakeHttpClient(new byte[] { 0x25, 0x50, 0x44, 0x46 });
        var sut = new IngestionPrompt(http, extractorMock.Object);
        var build = await sut.BuildAsync(MakeRun(url), EmptyExamples(), CancellationToken.None);

        // Should have gone through PDF path — text in the source seed file, prompt references it.
        build.SeedFiles.Should().Contain(sf => sf.RelativePath == "source/report.txt" && sf.Content == extractedText);
        build.PromptText.Should().Contain("source/report.txt");
        build.PromptText.Should().Contain("Do NOT fetch any URL");
    }

    // -------------------------------------------------------------------------
    // Pdf_ExtractEmpty_FallsBackToUrlPrompt
    // -------------------------------------------------------------------------
    [Fact]
    public async Task Pdf_ExtractEmpty_FallsBackToUrlPrompt()
    {
        const string url = "https://x/report.pdf";

        var extractorMock = new Mock<IPdfTextExtractor>();
        extractorMock.Setup(e => e.ExtractText(It.IsAny<byte[]>())).Returns(""); // empty

        var http = MakeHttpClient(new byte[] { 0x25, 0x50, 0x44, 0x46 });
        var sut = new IngestionPrompt(http, extractorMock.Object);
        var build = await sut.BuildAsync(MakeRun(url), EmptyExamples(), CancellationToken.None);

        // Should fall back to URL-based prompt
        build.PromptText.Should().Contain(url);
        build.PromptText.Should().NotContain("Do NOT fetch any URL");
        // Schema still present
        build.PromptText.Should().Contain("result.json");
        build.PromptText.Should().Contain("findings");
    }

    // -------------------------------------------------------------------------
    // IsPdfUrl — unit tests for the static helper
    // -------------------------------------------------------------------------

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
    // BothBranches_ContainSchemaKeywords
    // -------------------------------------------------------------------------
    [Theory]
    [InlineData("https://x/report")]       // URL branch
    [InlineData("https://x/report.pdf")]   // PDF branch (extractor returns text)
    public async Task BothBranches_ContainSchemaKeywords(string url)
    {
        var extractorMock = new Mock<IPdfTextExtractor>();
        extractorMock.Setup(e => e.ExtractText(It.IsAny<byte[]>())).Returns("some text");

        var http = MakeHttpClient(new byte[] { 1, 2, 3 });
        var sut = new IngestionPrompt(http, extractorMock.Object);
        var build = await sut.BuildAsync(MakeRun(url), EmptyExamples(), CancellationToken.None);

        build.PromptText.Should().Contain("result.json");
        build.PromptText.Should().Contain("findings");
        build.PromptText.Should().Contain("article.md");
    }

    // -------------------------------------------------------------------------
    // RichExamples_SeedFilesBuiltCorrectly
    // -------------------------------------------------------------------------
    [Fact]
    public async Task RichExamples_SeedFilesBuiltCorrectly()
    {
        const string url = "https://x/report";
        var extractorMock = new Mock<IPdfTextExtractor>();
        var http = MakeHttpClient();
        var sut = new IngestionPrompt(http, extractorMock.Object);

        var build = await sut.BuildAsync(MakeRun(url), RichExamples(), CancellationToken.None);

        // 2 articles + vulnerabilities.json + existing-finding-titles.txt + existing-report-titles.txt = 5
        build.SeedFiles.Should().HaveCount(5);

        // Articles indexed with 2-digit prefix and slugified title
        build.SeedFiles.Should().Contain(sf => sf.RelativePath == "examples/articles/00-my-first-audit.md");
        build.SeedFiles.Should().Contain(sf => sf.RelativePath == "examples/articles/01-second-report-here.md");

        // Article content preserved
        var art0 = build.SeedFiles.First(sf => sf.RelativePath == "examples/articles/00-my-first-audit.md");
        art0.Content.Should().Be("# My First Audit\ncontent");

        // Vulnerabilities JSON seed
        var vulnSeed = build.SeedFiles.First(sf => sf.RelativePath == "examples/vulnerabilities.json");
        var parsed = JsonSerializer.Deserialize<List<AgentExampleVulnDto>>(vulnSeed.Content,
            new JsonSerializerOptions(JsonSerializerDefaults.Web));
        parsed.Should().HaveCount(1);
        parsed![0].Title.Should().Be("Reentrancy Attack");

        // Existing finding titles
        var titlesSeed = build.SeedFiles.First(sf => sf.RelativePath == "examples/existing-finding-titles.txt");
        titlesSeed.Content.Should().Be("Old Finding One\nOld Finding Two");

        // Existing report titles (report-level dedup)
        var reportTitlesSeed = build.SeedFiles.First(sf => sf.RelativePath == "examples/existing-report-titles.txt");
        reportTitlesSeed.Content.Should().Be("Existing Report A\nExisting Report B");
    }

    // -------------------------------------------------------------------------
    // RichExamples_PromptContainsDedupSection
    // -------------------------------------------------------------------------
    [Fact]
    public async Task RichExamples_PromptContainsDedupSection()
    {
        const string url = "https://x/report";
        var extractorMock = new Mock<IPdfTextExtractor>();
        var http = MakeHttpClient();
        var sut = new IngestionPrompt(http, extractorMock.Object);

        var build = await sut.BuildAsync(MakeRun(url), RichExamples(), CancellationToken.None);

        build.PromptText.Should().Contain("de-duplication");
        build.PromptText.Should().Contain("existing-finding-titles.txt");
        // Schema still present
        build.PromptText.Should().Contain("result.json");
        build.PromptText.Should().Contain("findings");
        // URL still present
        build.PromptText.Should().Contain(url);
    }

    // -------------------------------------------------------------------------
    // EmptyExamples_NoSeedFilesAndNoDedupSection
    // -------------------------------------------------------------------------
    [Fact]
    public async Task EmptyExamples_NoSeedFilesAndNoDedupSection()
    {
        const string url = "https://x/report";
        var extractorMock = new Mock<IPdfTextExtractor>();
        var http = MakeHttpClient();
        var sut = new IngestionPrompt(http, extractorMock.Object);

        var build = await sut.BuildAsync(MakeRun(url), EmptyExamples(), CancellationToken.None);

        build.SeedFiles.Should().BeEmpty();
        build.PromptText.Should().NotContain("de-duplication");
        build.PromptText.Should().NotContain("existing-finding-titles.txt");
        // Core schema still present
        build.PromptText.Should().Contain("result.json");
    }

    // -------------------------------------------------------------------------
    // Pdf_Path_WithEmptyExamples_ReturnsBuild (PDF path still works with new sig)
    // -------------------------------------------------------------------------
    [Fact]
    public async Task Pdf_Path_WithEmptyExamples_ReturnsBuild()
    {
        const string url = "https://x/report.pdf";
        const string extractedText = "PDF CONTENT";

        var extractorMock = new Mock<IPdfTextExtractor>();
        extractorMock.Setup(e => e.ExtractText(It.IsAny<byte[]>())).Returns(extractedText);

        var http = MakeHttpClient(new byte[] { 0x25, 0x50, 0x44, 0x46 });
        var sut = new IngestionPrompt(http, extractorMock.Object);

        var build = await sut.BuildAsync(MakeRun(url), EmptyExamples(), CancellationToken.None);

        // Even with no examples, the PDF path emits exactly the source-report seed file.
        build.SeedFiles.Should().ContainSingle(sf => sf.RelativePath == "source/report.txt");
        build.SeedFiles.Single().Content.Should().Be(extractedText);
        build.PromptText.Should().Contain("source/report.txt");
        build.PromptText.Should().Contain("Do NOT fetch any URL");
        build.PromptText.Should().NotContain(extractedText);
    }

    // -------------------------------------------------------------------------
    // SchemaInstructions contains reportPdfUrl field and Download instruction
    // -------------------------------------------------------------------------

    [Theory]
    [InlineData("https://x/report")]       // URL branch
    [InlineData("https://x/report.pdf")]   // PDF branch (extractor returns text)
    public async Task BothBranches_ContainReportPdfUrlFieldAndDownloadInstruction(string url)
    {
        var extractorMock = new Mock<IPdfTextExtractor>();
        extractorMock.Setup(e => e.ExtractText(It.IsAny<byte[]>())).Returns("some text");

        var http = MakeHttpClient(new byte[] { 1, 2, 3 });
        var sut = new IngestionPrompt(http, extractorMock.Object);
        var build = await sut.BuildAsync(MakeRun(url), EmptyExamples(), CancellationToken.None);

        build.PromptText.Should().Contain("reportPdfUrl");
        build.PromptText.Should().Contain("Download");
    }

    // -------------------------------------------------------------------------
    // New prompt invariants: anti-injection guard, explicit enum vocab, self-verify count
    // -------------------------------------------------------------------------

    [Theory]
    [InlineData("https://x/report")]
    [InlineData("https://x/report.pdf")]
    public async Task Prompt_Has_AntiInjection_Guard_And_Strict_Vocab(string url)
    {
        var extractorMock = new Mock<IPdfTextExtractor>();
        extractorMock.Setup(e => e.ExtractText(It.IsAny<byte[]>())).Returns("some text");
        var http = MakeHttpClient(new byte[] { 1, 2, 3 });
        var sut = new IngestionPrompt(http, extractorMock.Object);

        var build = await sut.BuildAsync(MakeRun(url), EmptyExamples(), CancellationToken.None);

        // Untrusted-data / prompt-injection guard.
        build.PromptText.Should().Contain("untrusted DATA");
        // Explicit, enumerated severity + category vocabularies (drives valid output).
        build.PromptText.Should().Contain("critical, high, medium, low, note");
        build.PromptText.Should().Contain("false-positive");
        // Self-verify finding count.
        build.PromptText.Should().Contain("COUNT");
    }

    [Fact]
    public async Task Examples_Section_Tells_Agent_To_Read_Examples_And_Lists_ReportTitles()
    {
        const string url = "https://x/report";
        var extractorMock = new Mock<IPdfTextExtractor>();
        var http = MakeHttpClient();
        var sut = new IngestionPrompt(http, extractorMock.Object);

        var build = await sut.BuildAsync(MakeRun(url), RichExamples(), CancellationToken.None);

        build.PromptText.Should().Contain("Read it BEFORE writing");
        build.PromptText.Should().Contain("existing-report-titles.txt");
    }

    // -------------------------------------------------------------------------
    // Slug helper tests
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

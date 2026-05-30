using System.Net;
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

    // -------------------------------------------------------------------------
    // NonPdf_Url_PromptContainsUrl_NoDownload
    // -------------------------------------------------------------------------
    [Fact]
    public async Task NonPdf_Url_PromptContainsUrl_NoDownload()
    {
        const string url = "https://x/report";
        var extractorMock = new Mock<IPdfTextExtractor>();
        var handler = new TrackingHttpMessageHandler();
        var http = new HttpClient(handler);

        var sut = new IngestionPrompt(http, extractorMock.Object);
        var prompt = await sut.BuildAsync(MakeRun(url), CancellationToken.None);

        // Prompt must contain the URL
        prompt.Should().Contain(url);
        // Schema must be present in both branches
        prompt.Should().Contain("result.json");
        prompt.Should().Contain("findings");
        // No HTTP call should have been made
        handler.RequestCount.Should().Be(0);
        // Extractor must never have been called
        extractorMock.Verify(e => e.ExtractText(It.IsAny<byte[]>()), Times.Never);
    }

    // -------------------------------------------------------------------------
    // Pdf_Url_DownloadsAndEmbedsExtractedText
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
        var prompt = await sut.BuildAsync(MakeRun(url), CancellationToken.None);

        // Must embed the extracted text
        prompt.Should().Contain(extractedText);
        // Must NOT instruct the agent to fetch the PDF URL
        prompt.Should().NotContain($"Fetch and read the audit report at: {url}");
        // Must tell the agent NOT to fetch a URL
        prompt.Should().Contain("Do NOT fetch any URL");
        // Schema must be present
        prompt.Should().Contain("result.json");
        prompt.Should().Contain("findings");
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
        var prompt = await sut.BuildAsync(MakeRun(url), CancellationToken.None);

        // Should have gone through PDF path
        prompt.Should().Contain(extractedText);
        prompt.Should().Contain("Do NOT fetch any URL");
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
        var prompt = await sut.BuildAsync(MakeRun(url), CancellationToken.None);

        // Should fall back to URL-based prompt
        prompt.Should().Contain(url);
        prompt.Should().NotContain("Do NOT fetch any URL");
        // Schema still present
        prompt.Should().Contain("result.json");
        prompt.Should().Contain("findings");
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
        var prompt = await sut.BuildAsync(MakeRun(url), CancellationToken.None);

        prompt.Should().Contain("result.json");
        prompt.Should().Contain("findings");
        prompt.Should().Contain("article.md");
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

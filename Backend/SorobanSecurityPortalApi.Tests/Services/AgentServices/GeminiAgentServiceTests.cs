using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Services.AgentServices;
using SorobanSecurityPortalApi.Services.AgentServices.Types;

namespace SorobanSecurityPortalApi.Tests.Services.AgentServices;

/// <summary>
/// Unit tests for GeminiAgentService.
/// Tests cover API key validation, successful API calls, error handling,
/// JSON response parsing, timeout handling, and cancellation token support.
/// </summary>
public class GeminiAgentServiceTests
{
    private readonly Mock<IHttpClientFactory> _httpClientFactoryMock;
    private readonly Mock<ILogger<GeminiAgentService>> _loggerMock;
    private readonly Mock<ExtendedConfig> _extendedConfigMock;

    public GeminiAgentServiceTests()
    {
        _httpClientFactoryMock = new Mock<IHttpClientFactory>();
        _loggerMock = new Mock<ILogger<GeminiAgentService>>();
        _extendedConfigMock = new Mock<ExtendedConfig>(MockBehavior.Loose, null!);
    }

    #region API Key Validation Tests

    [Fact]
    public async Task CallAgentAsync_WhenApiKeyIsNull_ReturnsError()
    {
        // Arrange
        SetupExtendedConfig(geminiApiKey: null);
        var sut = CreateService();

        // Act
        var result = await sut.CallAgentAsync(AgentType.Parser, "test prompt");

        // Assert
        result.Should().BeOfType<Result<string, string>.Err>();
        var err = (Result<string, string>.Err)result;
        err.Error.Should().Be("Gemini API key is not configured.");
    }

    [Fact]
    public async Task CallAgentAsync_WhenApiKeyIsEmpty_ReturnsError()
    {
        // Arrange
        SetupExtendedConfig(geminiApiKey: "");
        var sut = CreateService();

        // Act
        var result = await sut.CallAgentAsync(AgentType.Parser, "test prompt");

        // Assert
        result.Should().BeOfType<Result<string, string>.Err>();
        var err = (Result<string, string>.Err)result;
        err.Error.Should().Be("Gemini API key is not configured.");
    }

    [Fact]
    public async Task CallAgentAsync_WhenApiKeyIsWhitespace_ReturnsError()
    {
        // Arrange
        SetupExtendedConfig(geminiApiKey: "   ");
        var sut = CreateService();

        // Act
        var result = await sut.CallAgentAsync(AgentType.Parser, "test prompt");

        // Assert
        result.Should().BeOfType<Result<string, string>.Err>();
        var err = (Result<string, string>.Err)result;
        err.Error.Should().Be("Gemini API key is not configured.");
    }

    #endregion

    #region Successful API Call Tests

    [Theory]
    [InlineData(AgentType.Parser)]
    [InlineData(AgentType.Extractor)]
    [InlineData(AgentType.Classifier)]
    [InlineData(AgentType.Validator)]
    public async Task CallAgentAsync_WithValidApiKey_CallsCorrectEndpoint(AgentType agentType)
    {
        // Arrange
        SetupExtendedConfig(geminiApiKey: "test-api-key", geminiModel: "gemini-2.0-flash");
        var mockResponse = CreateGeminiResponse("""{"result": "success"}""");
        var mockHandler = CreateMockHttpHandler(mockResponse);
        SetupHttpClient(mockHandler);
        var sut = CreateService();

        // Act
        var result = await sut.CallAgentAsync(agentType, "test prompt");

        // Assert
        result.Should().BeOfType<Result<string, string>.Ok>();
        var ok = (Result<string, string>.Ok)result;
        ok.Value.Should().Be("""{"result": "success"}""");
    }

    [Fact]
    public async Task CallAgentAsync_WithDefaultModel_UsesGeminiFlash()
    {
        // Arrange
        SetupExtendedConfig(geminiApiKey: "test-api-key", geminiModel: null);
        HttpRequestMessage? capturedRequest = null;
        var mockResponse = CreateGeminiResponse("""{"test": true}""");
        var mockHandler = new MockHttpMessageHandler((request, _) =>
        {
            capturedRequest = request;
            return Task.FromResult(mockResponse);
        });
        SetupHttpClient(mockHandler);
        var sut = CreateService();

        // Act
        await sut.CallAgentAsync(AgentType.Parser, "test prompt");

        // Assert
        capturedRequest.Should().NotBeNull();
        capturedRequest!.RequestUri!.ToString().Should().Contain("gemini-2.0-flash");
    }

    [Fact]
    public async Task CallAgentAsync_SendsApiKeyInHeader()
    {
        // Arrange
        const string expectedApiKey = "my-secret-api-key";
        SetupExtendedConfig(geminiApiKey: expectedApiKey);
        HttpRequestMessage? capturedRequest = null;
        var mockResponse = CreateGeminiResponse("""{"test": true}""");
        var mockHandler = new MockHttpMessageHandler((request, _) =>
        {
            capturedRequest = request;
            return Task.FromResult(mockResponse);
        });
        SetupHttpClient(mockHandler);
        var sut = CreateService();

        // Act
        await sut.CallAgentAsync(AgentType.Parser, "test prompt");

        // Assert
        capturedRequest.Should().NotBeNull();
        capturedRequest!.Headers.Contains("x-goog-api-key").Should().BeTrue();
        capturedRequest.Headers.GetValues("x-goog-api-key").First().Should().Be(expectedApiKey);
    }

    [Fact]
    public async Task CallAgentAsync_SendsUserPromptInRequestBody()
    {
        // Arrange
        const string userPrompt = "Analyze this vulnerability report";
        SetupExtendedConfig(geminiApiKey: "test-key");
        string? capturedBody = null;
        var mockResponse = CreateGeminiResponse("""{"test": true}""");
        var mockHandler = new MockHttpMessageHandler(async (request, _) =>
        {
            capturedBody = await request.Content!.ReadAsStringAsync();
            return mockResponse;
        });
        SetupHttpClient(mockHandler);
        var sut = CreateService();

        // Act
        await sut.CallAgentAsync(AgentType.Parser, userPrompt);

        // Assert
        capturedBody.Should().NotBeNull();
        capturedBody.Should().Contain(userPrompt);
    }

    #endregion

    #region Error Response Handling Tests

    [Theory]
    [InlineData(HttpStatusCode.BadRequest)]
    [InlineData(HttpStatusCode.Unauthorized)]
    [InlineData(HttpStatusCode.Forbidden)]
    [InlineData(HttpStatusCode.NotFound)]
    [InlineData(HttpStatusCode.InternalServerError)]
    [InlineData(HttpStatusCode.ServiceUnavailable)]
    public async Task CallAgentAsync_WhenApiReturnsError_ReturnsErrorResult(HttpStatusCode statusCode)
    {
        // Arrange
        SetupExtendedConfig(geminiApiKey: "test-key");
        var mockResponse = new HttpResponseMessage(statusCode)
        {
            Content = new StringContent("Error occurred")
        };
        var mockHandler = CreateMockHttpHandler(mockResponse);
        SetupHttpClient(mockHandler);
        var sut = CreateService();

        // Act
        var result = await sut.CallAgentAsync(AgentType.Parser, "test prompt");

        // Assert
        result.Should().BeOfType<Result<string, string>.Err>();
        var err = (Result<string, string>.Err)result;
        err.Error.Should().Contain($"Gemini API error: {statusCode}");
    }

    #endregion

    #region JSON Response Parsing Tests

    [Fact]
    public async Task CallAgentAsync_WithValidJsonResponse_ExtractsTextContent()
    {
        // Arrange
        SetupExtendedConfig(geminiApiKey: "test-key");
        var expectedJson = """{"sections": [{"id": 1, "title": "Test"}]}""";
        var mockResponse = CreateGeminiResponse(expectedJson);
        var mockHandler = CreateMockHttpHandler(mockResponse);
        SetupHttpClient(mockHandler);
        var sut = CreateService();

        // Act
        var result = await sut.CallAgentAsync(AgentType.Parser, "test prompt");

        // Assert
        result.Should().BeOfType<Result<string, string>.Ok>();
        var ok = (Result<string, string>.Ok)result;
        ok.Value.Should().Be(expectedJson);
    }

    [Fact]
    public async Task CallAgentAsync_WithEmptyTextResponse_ReturnsError()
    {
        // Arrange
        SetupExtendedConfig(geminiApiKey: "test-key");
        var mockResponse = CreateGeminiResponse(""); // Empty text
        var mockHandler = CreateMockHttpHandler(mockResponse);
        SetupHttpClient(mockHandler);
        var sut = CreateService();

        // Act
        var result = await sut.CallAgentAsync(AgentType.Parser, "test prompt");

        // Assert
        result.Should().BeOfType<Result<string, string>.Err>();
        var err = (Result<string, string>.Err)result;
        err.Error.Should().Be("Failed to parse Gemini response.");
    }

    [Fact]
    public async Task CallAgentAsync_WithMalformedJsonResponse_ReturnsError()
    {
        // Arrange
        SetupExtendedConfig(geminiApiKey: "test-key");
        var malformedResponse = new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent("not valid json")
        };
        var mockHandler = CreateMockHttpHandler(malformedResponse);
        SetupHttpClient(mockHandler);
        var sut = CreateService();

        // Act
        var result = await sut.CallAgentAsync(AgentType.Parser, "test prompt");

        // Assert
        result.Should().BeOfType<Result<string, string>.Err>();
        var err = (Result<string, string>.Err)result;
        err.Error.Should().Contain("JSON parsing error");
    }

    [Fact]
    public async Task CallAgentAsync_WithMissingCandidatesArray_ReturnsError()
    {
        // Arrange
        SetupExtendedConfig(geminiApiKey: "test-key");
        var responseWithNoCandidates = new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent("""{"result": "no candidates"}""")
        };
        var mockHandler = CreateMockHttpHandler(responseWithNoCandidates);
        SetupHttpClient(mockHandler);
        var sut = CreateService();

        // Act
        var result = await sut.CallAgentAsync(AgentType.Parser, "test prompt");

        // Assert
        result.Should().BeOfType<Result<string, string>.Err>();
        var err = (Result<string, string>.Err)result;
        err.Error.Should().Be("Failed to parse Gemini response.");
    }

    [Fact]
    public async Task CallAgentAsync_WithEmptyCandidatesArray_ReturnsError()
    {
        // Arrange
        SetupExtendedConfig(geminiApiKey: "test-key");
        var responseWithEmptyCandidates = new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent("""{"candidates": []}""")
        };
        var mockHandler = CreateMockHttpHandler(responseWithEmptyCandidates);
        SetupHttpClient(mockHandler);
        var sut = CreateService();

        // Act
        var result = await sut.CallAgentAsync(AgentType.Parser, "test prompt");

        // Assert
        result.Should().BeOfType<Result<string, string>.Err>();
        var err = (Result<string, string>.Err)result;
        err.Error.Should().Be("Failed to parse Gemini response.");
    }

    #endregion

    #region Timeout Handling Tests

    [Fact]
    public async Task CallAgentAsync_WhenHttpRequestTimesOut_ReturnsTimeoutError()
    {
        // Arrange
        SetupExtendedConfig(geminiApiKey: "test-key");
        var mockHandler = new MockHttpMessageHandler((_, ct) =>
        {
            // Simulate a timeout by throwing TaskCanceledException without cancellation requested
            throw new TaskCanceledException("The request timed out.");
        });
        SetupHttpClient(mockHandler);
        var sut = CreateService();

        // Act
        var result = await sut.CallAgentAsync(AgentType.Parser, "test prompt");

        // Assert
        result.Should().BeOfType<Result<string, string>.Err>();
        var err = (Result<string, string>.Err)result;
        err.Error.Should().Be("Gemini API request timed out.");
    }

    #endregion

    #region Cancellation Token Tests

    [Fact]
    public async Task CallAgentAsync_WhenCancellationRequested_ReturnsCancelledError()
    {
        // Arrange
        SetupExtendedConfig(geminiApiKey: "test-key");
        using var cts = new CancellationTokenSource();
        cts.Cancel();

        var mockHandler = new MockHttpMessageHandler((_, ct) =>
        {
            ct.ThrowIfCancellationRequested();
            return Task.FromResult(CreateGeminiResponse("test"));
        });
        SetupHttpClient(mockHandler);
        var sut = CreateService();

        // Act
        var result = await sut.CallAgentAsync(AgentType.Parser, "test prompt", cts.Token);

        // Assert
        result.Should().BeOfType<Result<string, string>.Err>();
        var err = (Result<string, string>.Err)result;
        err.Error.Should().Be("Operation was cancelled.");
    }

    [Fact]
    public async Task CallAgentAsync_WithValidToken_CompletesSuccessfully()
    {
        // Arrange
        SetupExtendedConfig(geminiApiKey: "test-key");
        using var cts = new CancellationTokenSource();
        var mockResponse = CreateGeminiResponse("""{"test": true}""");
        var mockHandler = CreateMockHttpHandler(mockResponse);
        SetupHttpClient(mockHandler);
        var sut = CreateService();

        // Act
        var result = await sut.CallAgentAsync(AgentType.Parser, "test prompt", cts.Token);

        // Assert
        result.Should().BeOfType<Result<string, string>.Ok>();
    }

    #endregion

    #region HTTP Request Exception Tests

    [Fact]
    public async Task CallAgentAsync_WhenHttpRequestFails_ReturnsHttpError()
    {
        // Arrange
        SetupExtendedConfig(geminiApiKey: "test-key");
        var mockHandler = new MockHttpMessageHandler((_, _) =>
        {
            throw new HttpRequestException("Network error");
        });
        SetupHttpClient(mockHandler);
        var sut = CreateService();

        // Act
        var result = await sut.CallAgentAsync(AgentType.Parser, "test prompt");

        // Assert
        result.Should().BeOfType<Result<string, string>.Err>();
        var err = (Result<string, string>.Err)result;
        err.Error.Should().Contain("HTTP error");
    }

    #endregion

    #region Unexpected Exception Tests

    [Fact]
    public async Task CallAgentAsync_WhenUnexpectedExceptionOccurs_ReturnsUnexpectedError()
    {
        // Arrange
        SetupExtendedConfig(geminiApiKey: "test-key");
        var mockHandler = new MockHttpMessageHandler((_, _) =>
        {
            throw new InvalidOperationException("Something went wrong");
        });
        SetupHttpClient(mockHandler);
        var sut = CreateService();

        // Act
        var result = await sut.CallAgentAsync(AgentType.Parser, "test prompt");

        // Assert
        result.Should().BeOfType<Result<string, string>.Err>();
        var err = (Result<string, string>.Err)result;
        err.Error.Should().Contain("Unexpected error");
    }

    #endregion

    #region Helper Methods

    private GeminiAgentService CreateService()
    {
        return new GeminiAgentService(
            _extendedConfigMock.Object,
            _httpClientFactoryMock.Object,
            _loggerMock.Object);
    }

    private void SetupExtendedConfig(string? geminiApiKey = "test-key", string? geminiModel = "gemini-2.0-flash")
    {
        _extendedConfigMock.Setup(x => x.GeminiApiKey).Returns(geminiApiKey!);
        _extendedConfigMock.Setup(x => x.GeminiGenerativeModel).Returns(geminiModel!);
    }

    private void SetupHttpClient(MockHttpMessageHandler handler)
    {
        var httpClient = new HttpClient(handler)
        {
            BaseAddress = new Uri("https://generativelanguage.googleapis.com")
        };
        _httpClientFactoryMock.Setup(x => x.CreateClient(HttpClients.AgentClient))
            .Returns(httpClient);
    }

    private static HttpResponseMessage CreateGeminiResponse(string textContent)
    {
        var responseBody = new
        {
            candidates = new[]
            {
                new
                {
                    content = new
                    {
                        parts = new[]
                        {
                            new { text = textContent }
                        }
                    }
                }
            }
        };

        return new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(
                JsonSerializer.Serialize(responseBody),
                Encoding.UTF8,
                "application/json")
        };
    }

    private static MockHttpMessageHandler CreateMockHttpHandler(HttpResponseMessage response)
    {
        return new MockHttpMessageHandler((_, _) => Task.FromResult(response));
    }

    #endregion
}

/// <summary>
/// Mock HTTP message handler for testing HTTP client behavior.
/// </summary>
public class MockHttpMessageHandler : HttpMessageHandler
{
    private readonly Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> _handler;

    public MockHttpMessageHandler(Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> handler)
    {
        _handler = handler;
    }

    protected override Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request,
        CancellationToken cancellationToken)
    {
        return _handler(request, cancellationToken);
    }
}

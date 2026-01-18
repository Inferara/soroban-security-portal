using System.Text;
using System.Text.Json;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Services.AgentServices.Types;

namespace SorobanSecurityPortalApi.Services.AgentServices;

/// <summary>
/// Service for calling Gemini AI agents for vulnerability extraction.
/// </summary>
public class GeminiAgentService : IGeminiAgentService
{
    private readonly ExtendedConfig _extendedConfig;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<GeminiAgentService> _logger;

    private static readonly Dictionary<AgentType, string> SystemPrompts = new()
    {
        [AgentType.Parser] = AgentPrompts.ParserSystemPrompt,
        [AgentType.Extractor] = AgentPrompts.ExtractorSystemPrompt,
        [AgentType.Classifier] = AgentPrompts.ClassifierSystemPrompt,
    };

    public GeminiAgentService(
        ExtendedConfig extendedConfig,
        IHttpClientFactory httpClientFactory,
        ILogger<GeminiAgentService> logger)
    {
        _extendedConfig = extendedConfig;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    public async Task<Result<string, string>> CallAgentAsync(
        AgentType agentType,
        string userPrompt,
        CancellationToken ct = default)
    {
        var apiKey = _extendedConfig.GeminiApiKey;
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            return new Result<string, string>.Err("Gemini API key is not configured.");
        }

        var model = _extendedConfig.GeminiGenerativeModel;
        if (string.IsNullOrWhiteSpace(model))
        {
            model = "gemini-2.0-flash"; // Default model
        }

        var systemPrompt = SystemPrompts[agentType];

        try
        {
            var httpClient = _httpClientFactory.CreateClient(HttpClients.AgentClient);

            // Build the request payload following Gemini API structure
            var payload = new
            {
                contents = new[]
                {
                    new
                    {
                        role = "user",
                        parts = new[]
                        {
                            new { text = userPrompt }
                        }
                    }
                },
                systemInstruction = new
                {
                    parts = new[]
                    {
                        new { text = systemPrompt }
                    }
                },
                generationConfig = new
                {
                    responseMimeType = "application/json",
                    temperature = 0.1, // Low temperature for more deterministic output
                    //maxOutputTokens = 65536 // Large limit to handle full vulnerability descriptions with code blocks
                }
            };

            var url = $"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent";

            using var request = new HttpRequestMessage(HttpMethod.Post, url);
            request.Content = new StringContent(
                JsonSerializer.Serialize(payload),
                Encoding.UTF8,
                "application/json");
            request.Headers.Add("x-goog-api-key", apiKey);

            _logger.LogInformation("Calling Gemini agent {AgentType} with model {Model}", agentType, model);

            using var response = await httpClient.SendAsync(request, ct);

            if (!response.IsSuccessStatusCode)
            {
                var errorContent = await response.Content.ReadAsStringAsync(ct);
                // Truncate error content to prevent logging sensitive information
                var truncatedError = errorContent.Length > 200
                    ? errorContent[..200] + "..."
                    : errorContent;
                _logger.LogError(
                    "Gemini API error for agent {AgentType}: {StatusCode} - {ErrorPreview}",
                    agentType,
                    response.StatusCode,
                    truncatedError);

                return new Result<string, string>.Err(
                    $"Gemini API error: {response.StatusCode}");
            }

            var responseContent = await response.Content.ReadAsStringAsync(ct);

            // Parse the Gemini response to extract the text content
            using var doc = JsonDocument.Parse(responseContent);
            var root = doc.RootElement;

            // Navigate to candidates[0].content.parts[0].text
            if (root.TryGetProperty("candidates", out var candidates) &&
                candidates.GetArrayLength() > 0)
            {
                var candidate = candidates[0];
                if (candidate.TryGetProperty("content", out var content) &&
                    content.TryGetProperty("parts", out var parts) &&
                    parts.GetArrayLength() > 0)
                {
                    var firstPart = parts[0];
                    if (firstPart.TryGetProperty("text", out var textElement))
                    {
                        var jsonResponse = textElement.GetString();
                        if (!string.IsNullOrWhiteSpace(jsonResponse))
                        {
                            _logger.LogInformation(
                                "Gemini agent {AgentType} completed successfully",
                                agentType);
                            return new Result<string, string>.Ok(jsonResponse);
                        }
                    }
                }
            }

            // Truncate response to prevent logging excessive data
            var truncatedResponse = responseContent.Length > 500
                ? responseContent[..500] + "..."
                : responseContent;
            _logger.LogError(
                "Failed to parse Gemini response for agent {AgentType}: {ResponsePreview}",
                agentType,
                truncatedResponse);

            return new Result<string, string>.Err("Failed to parse Gemini response.");
        }
        catch (TaskCanceledException) when (ct.IsCancellationRequested)
        {
            _logger.LogWarning("Gemini agent {AgentType} was cancelled", agentType);
            return new Result<string, string>.Err("Operation was cancelled.");
        }
        catch (TaskCanceledException)
        {
            _logger.LogError("Gemini agent {AgentType} timed out", agentType);
            return new Result<string, string>.Err("Gemini API request timed out.");
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "HTTP error calling Gemini agent {AgentType}", agentType);
            return new Result<string, string>.Err($"HTTP error: {ex.Message}");
        }
        catch (JsonException ex)
        {
            _logger.LogError(ex, "JSON parsing error for Gemini agent {AgentType}", agentType);
            return new Result<string, string>.Err($"JSON parsing error: {ex.Message}");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error calling Gemini agent {AgentType}", agentType);
            return new Result<string, string>.Err($"Unexpected error: {ex.Message}");
        }
    }
}

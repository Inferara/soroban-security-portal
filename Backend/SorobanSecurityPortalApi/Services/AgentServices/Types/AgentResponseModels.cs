using System.Text.Json;
using System.Text.Json.Serialization;

namespace SorobanSecurityPortalApi.Services.AgentServices.Types;

#region Parser Agent Response

public class ParserAgentResponse
{
    [JsonPropertyName("sections")]
    public List<VulnerabilitySection> Sections { get; set; } = new();

    [JsonPropertyName("metadata")]
    public ReportMetadata? Metadata { get; set; }
}

public class VulnerabilitySection
{
    [JsonPropertyName("id")]
    public int Id { get; set; }

    [JsonPropertyName("startLine")]
    public int StartLine { get; set; }

    [JsonPropertyName("endLine")]
    public int EndLine { get; set; }

    [JsonPropertyName("title")]
    public string Title { get; set; } = string.Empty;

    [JsonPropertyName("context")]
    public string Context { get; set; } = string.Empty;
}

public class ReportMetadata
{
    [JsonPropertyName("totalFindings")]
    public int TotalFindings { get; set; }

    [JsonPropertyName("auditScope")]
    public string? AuditScope { get; set; }
}

#endregion

#region Extractor Agent Response

public class ExtractorAgentResponse
{
    [JsonPropertyName("vulnerabilities")]
    public List<RawVulnerability> Vulnerabilities { get; set; } = new();
}

public class RawVulnerability
{
    /// <summary>
    /// Section identifier - can be int or string depending on LLM output.
    /// Using object type with custom handling for flexibility.
    /// </summary>
    [JsonPropertyName("sectionId")]
    [JsonConverter(typeof(FlexibleSectionIdConverter))]
    public string SectionId { get; set; } = string.Empty;

    [JsonPropertyName("title")]
    public string Title { get; set; } = string.Empty;

    [JsonPropertyName("description")]
    public string Description { get; set; } = string.Empty;

    [JsonPropertyName("impact")]
    public string Impact { get; set; } = string.Empty;

    [JsonPropertyName("recommendation")]
    public string Recommendation { get; set; } = string.Empty;

    [JsonPropertyName("location")]
    public string? Location { get; set; }

    [JsonPropertyName("codeBlocks")]
    public List<CodeBlock>? CodeBlocks { get; set; }

    [JsonPropertyName("links")]
    public List<string>? Links { get; set; }
}

public class CodeBlock
{
    [JsonPropertyName("language")]
    public string Language { get; set; } = string.Empty;

    [JsonPropertyName("code")]
    public string Code { get; set; } = string.Empty;
}

#endregion

#region Classifier Agent Response

public class ClassifierAgentResponse
{
    [JsonPropertyName("vulnerabilities")]
    public List<ClassifiedVulnerability> Vulnerabilities { get; set; } = new();
}

public class ClassifiedVulnerability : RawVulnerability
{
    [JsonPropertyName("severity")]
    public string Severity { get; set; } = "medium";

    [JsonPropertyName("tags")]
    public List<string> Tags { get; set; } = new();

    [JsonPropertyName("category")]
    public int Category { get; set; } = 100; // NA by default
}

#endregion

#region JSON Converters

/// <summary>
/// Flexible converter that handles sectionId as either int or string from LLM output.
/// </summary>
public class FlexibleSectionIdConverter : JsonConverter<string>
{
    public override string Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        return reader.TokenType switch
        {
            JsonTokenType.String => reader.GetString() ?? string.Empty,
            JsonTokenType.Number => reader.GetInt32().ToString(),
            _ => string.Empty
        };
    }

    public override void Write(Utf8JsonWriter writer, string value, JsonSerializerOptions options)
    {
        writer.WriteStringValue(value);
    }
}

#endregion

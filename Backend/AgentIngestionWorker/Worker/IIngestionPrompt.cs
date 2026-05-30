using System.Text.Json;
using System.Text.RegularExpressions;
using AgentIngestionWorker.Api;
using AgentIngestionWorker.OpenCode;
using AgentIngestionWorker.Pdf;

namespace AgentIngestionWorker.Worker;

public interface IIngestionPrompt
{
    Task<PromptBuild> BuildAsync(ClaimedRun run, AgentExamplesDto examples, CancellationToken ct);
}

public sealed class IngestionPrompt : IIngestionPrompt
{
    private static readonly JsonSerializerOptions WebOptions = new(JsonSerializerDefaults.Web);

    private readonly HttpClient _http;
    private readonly IPdfTextExtractor _extractor;

    public IngestionPrompt(HttpClient http, IPdfTextExtractor extractor)
    {
        _http = http;
        _extractor = extractor;
    }

    /// <summary>
    /// Returns true if the URL path (ignoring query-string) ends with ".pdf" (case-insensitive).
    /// </summary>
    internal static bool IsPdfUrl(string url)
    {
        if (string.IsNullOrWhiteSpace(url)) return false;
        try
        {
            var path = new Uri(url, UriKind.Absolute).AbsolutePath;
            return path.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase);
        }
        catch
        {
            // Non-parseable URL — treat as non-PDF
            return false;
        }
    }

    /// <summary>
    /// Converts a title into a URL-safe slug: lowercase, non-alphanumeric chars → '-', trimmed, max ~40 chars.
    /// </summary>
    internal static string Slug(string title)
    {
        if (string.IsNullOrWhiteSpace(title)) return "article";
        var slug = Regex.Replace(title.ToLowerInvariant(), @"[^a-z0-9]+", "-").Trim('-');
        if (string.IsNullOrEmpty(slug)) return "article";
        return slug.Length > 40 ? slug[..40].TrimEnd('-') : slug;
    }

    public async Task<PromptBuild> BuildAsync(ClaimedRun run, AgentExamplesDto examples, CancellationToken ct)
    {
        string promptText;

        if (IsPdfUrl(run.SourceUrl))
        {
            string text;
            try
            {
                var bytes = await _http.GetByteArrayAsync(run.SourceUrl, ct);
                text = _extractor.ExtractText(bytes);
            }
            catch
            {
                text = "";
            }

            if (!string.IsNullOrWhiteSpace(text))
            {
                promptText = BuildPdfPrompt(text);
                return new PromptBuild
                {
                    PromptText = AppendExamplesSection(promptText, examples),
                    SeedFiles = BuildSeedFiles(examples),
                };
            }

            // Fall back to URL-based prompt if extraction yielded nothing
        }

        promptText = BuildUrlPrompt(run.SourceUrl);
        return new PromptBuild
        {
            PromptText = AppendExamplesSection(promptText, examples),
            SeedFiles = BuildSeedFiles(examples),
        };
    }

    // -------------------------------------------------------------------------
    // Shared schema/instructions
    // -------------------------------------------------------------------------

    private const string SchemaInstructions = """
        Write EXACTLY two files in the current directory:
        1. article.md — a consistent Markdown article (title, metadata, ## Summary, ## Scope, ## Findings with one ### per finding).
        2. result.json — { "reportTitle": string, "protocolName": string (audited project), "auditorName": string, "reportDate": "YYYY-MM-DD" or null, "reportPdfUrl": string, "findings": [ { "title": string, "description": string, "severity": "critical"|"high"|"medium"|"low"|"note", "tags": string[], "category": 0|1|2|3|100 } ] }.
        Map observation/informational to "note"; if a finding is fixed/resolved use category 0. Extract ALL findings. Output ONLY those two files.
        Also find the direct download link to the ORIGINAL report document (a PDF) on the page — e.g. the href behind a 'Download' / 'Download report' / 'PDF' button — and put that absolute URL in `reportPdfUrl`. If the source URL you were given is itself a PDF, use it. Use an empty string if there is genuinely no downloadable PDF.
        """;

    private static string BuildPdfPrompt(string reportText) => $"""
        You are an audit-report ingestion agent for a Soroban/Stellar security portal.
        Here is the FULL TEXT of the audit report (already extracted from a PDF). Do NOT fetch any URL. Read this text and produce the two files:
        {SchemaInstructions}
        REPORT TEXT:

        {reportText}
        """;

    private static string BuildUrlPrompt(string sourceUrl) => $"""
        You are an audit-report ingestion agent for a Soroban/Stellar security portal.
        Fetch and read the audit report at: {sourceUrl}
        {SchemaInstructions}
        """;

    // -------------------------------------------------------------------------
    // Few-shot examples section
    // -------------------------------------------------------------------------

    private static bool HasExamples(AgentExamplesDto examples) =>
        examples.Articles.Count > 0
        || examples.Vulnerabilities.Count > 0
        || examples.ExistingFindingTitles.Count > 0;

    private static string AppendExamplesSection(string basePrompt, AgentExamplesDto examples)
    {
        if (!HasExamples(examples)) return basePrompt;

        return basePrompt + """


            ## Consistency & de-duplication
            The `examples/` folder contains existing portal content: `examples/articles/*.md` (past articles) and `examples/vulnerabilities.json` (past vulnerabilities with their severity/category/tags). Read them and match their structure, tone, severity wording, category values, and TAG VOCABULARY exactly so the portal stays uniform. `examples/existing-finding-titles.txt` lists titles that already exist in the portal — do NOT emit a finding whose title duplicates any of them; only include genuinely new findings from THIS report.
            """;
    }

    private static List<SeedFile> BuildSeedFiles(AgentExamplesDto examples)
    {
        if (!HasExamples(examples)) return new List<SeedFile>();

        var seeds = new List<SeedFile>();

        for (int i = 0; i < examples.Articles.Count; i++)
        {
            var article = examples.Articles[i];
            var path = $"examples/articles/{i:00}-{Slug(article.Title)}.md";
            seeds.Add(new SeedFile(path, article.Markdown));
        }

        seeds.Add(new SeedFile(
            "examples/vulnerabilities.json",
            JsonSerializer.Serialize(examples.Vulnerabilities, WebOptions)));

        seeds.Add(new SeedFile(
            "examples/existing-finding-titles.txt",
            string.Join("\n", examples.ExistingFindingTitles)));

        return seeds;
    }
}

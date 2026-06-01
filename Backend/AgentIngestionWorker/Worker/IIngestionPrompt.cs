using System.Text.Json;
using System.Text.RegularExpressions;
using AgentIngestionWorker.Api;
using AgentIngestionWorker.OpenCode;
using AgentIngestionWorker.Pdf;

namespace AgentIngestionWorker.Worker;

public interface IIngestionPrompt
{
    Task<PromptBuild> BuildAsync(ClaimedRun run, AgentExamplesDto examples, AgentPromptConfigDto config, CancellationToken ct);
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

    public async Task<PromptBuild> BuildAsync(ClaimedRun run, AgentExamplesDto examples, AgentPromptConfigDto config, CancellationToken ct)
    {
        var examplesSection = BuildExamplesSection(examples, config);

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
                // Write the (potentially large) report text as a workspace file rather than inlining it
                // into the prompt: opencode receives the prompt as a command-line argument, and a full
                // PDF's worth of text blows the OS command-line length limit. The agent reads the file.
                var seeds = BuildSeedFiles(examples);
                seeds.Add(new SeedFile(SourceReportPath, text));
                return new PromptBuild
                {
                    PromptText = BuildPdfPrompt(config, examplesSection),
                    SeedFiles = seeds,
                };
            }
            // Fall back to URL-based prompt if extraction yielded nothing.
        }

        return new PromptBuild
        {
            PromptText = BuildUrlPrompt(run.SourceUrl, config, examplesSection),
            SeedFiles = BuildSeedFiles(examples),
        };
    }

    // -------------------------------------------------------------------------
    // Prompt composition (the TEXT comes from AgentPromptConfigDto, served by the API from
    // Admin Settings; this class only supplies the mechanical glue and ordering)
    // -------------------------------------------------------------------------

    // Where the extracted PDF text is written in the agent's workspace (see BuildAsync).
    internal const string SourceReportPath = "source/report.txt";

    private static string BuildUrlPrompt(string sourceUrl, AgentPromptConfigDto config, string examplesSection) =>
        $"{config.Preamble}\n\nFetch and read the audit report at: {sourceUrl}\n\n{config.Instructions}{examplesSection}";

    private static string BuildPdfPrompt(AgentPromptConfigDto config, string examplesSection) =>
        $"{config.Preamble}\n\nThe full text of the audit report has been saved to the file `{SourceReportPath}` in your "
        + $"working directory (already extracted from its PDF). Read that file and analyze ONLY its contents. "
        + $"Do NOT fetch any URL.\n\n{config.Instructions}{examplesSection}";

    // -------------------------------------------------------------------------
    // Few-shot examples / de-duplication
    // -------------------------------------------------------------------------

    private static bool HasExamples(AgentExamplesDto examples) =>
        examples.Articles.Count > 0
        || examples.Vulnerabilities.Count > 0
        || examples.ExistingFindingTitles.Count > 0
        || examples.ExistingReportTitles.Count > 0;

    // Append the (configurable) examples/de-dup guidance only when example content is actually present.
    private static string BuildExamplesSection(AgentExamplesDto examples, AgentPromptConfigDto config)
        => HasExamples(examples) && !string.IsNullOrWhiteSpace(config.ExamplesGuidance)
            ? "\n\n" + config.ExamplesGuidance
            : string.Empty;

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

        // Only emit the report-titles seed when there are report titles to dedup against, so empty
        // installs don't get a stray empty file (and the seed-file count stays predictable).
        if (examples.ExistingReportTitles.Count > 0)
        {
            seeds.Add(new SeedFile(
                "examples/existing-report-titles.txt",
                string.Join("\n", examples.ExistingReportTitles)));
        }

        return seeds;
    }
}

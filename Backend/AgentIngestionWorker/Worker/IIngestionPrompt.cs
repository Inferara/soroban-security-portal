using AgentIngestionWorker.Api;
using AgentIngestionWorker.Pdf;

namespace AgentIngestionWorker.Worker;

public interface IIngestionPrompt
{
    Task<string> BuildAsync(ClaimedRun run, CancellationToken ct);
}

public sealed class IngestionPrompt : IIngestionPrompt
{
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

    public async Task<string> BuildAsync(ClaimedRun run, CancellationToken ct)
    {
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
                return BuildPdfPrompt(text);

            // Fall back to URL-based prompt if extraction yielded nothing
        }

        return BuildUrlPrompt(run.SourceUrl);
    }

    // -------------------------------------------------------------------------
    // Shared schema/instructions
    // -------------------------------------------------------------------------

    private const string SchemaInstructions = """
        Write EXACTLY two files in the current directory:
        1. article.md — a consistent Markdown article (title, metadata, ## Summary, ## Scope, ## Findings with one ### per finding).
        2. result.json — { "reportTitle": string, "protocolName": string (audited project), "auditorName": string, "reportDate": "YYYY-MM-DD" or null, "findings": [ { "title": string, "description": string, "severity": "critical"|"high"|"medium"|"low"|"note", "tags": string[], "category": 0|1|2|3|100 } ] }.
        Map observation/informational to "note"; if a finding is fixed/resolved use category 0. Extract ALL findings. Output ONLY those two files.
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
}

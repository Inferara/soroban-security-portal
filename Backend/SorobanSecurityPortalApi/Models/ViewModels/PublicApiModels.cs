namespace SorobanSecurityPortalApi.Models.ViewModels
{
    // Shapes returned by the public surface (REST at /api/public/v1 and the MCP tools).
    // They are a contract with outside callers: add fields freely, never rename or remove one.

    public class PublicRef
    {
        public int Id { get; set; }
        public string Name { get; set; } = "";
    }

    public class PublicPage<T>
    {
        public List<T> Items { get; set; } = new();
        public int Total { get; set; }
        public int Page { get; set; }
        public int PageSize { get; set; }
        public bool HasMore { get; set; }
    }

    public class PublicVulnerabilityPage : PublicPage<PublicVulnerabilitySummary>
    {
        // "semantic" (text + embeddings), "keyword" (text only: the embedding provider was
        // unavailable), or "none" (no query text, newest first).
        public string SearchMode { get; set; } = "none";
    }

    public class PublicVulnerabilitySummary
    {
        public int Id { get; set; }
        public string Title { get; set; } = "";
        // critical | high | medium | low | note
        public string Severity { get; set; } = "";
        // Valid | ValidNotFixed | ValidPartiallyFixed | Acknowledged | NA
        public string Category { get; set; } = "";
        public List<string> Tags { get; set; } = new();
        public DateTime Date { get; set; }
        public PublicRef? Report { get; set; }
        public PublicRef? Protocol { get; set; }
        public PublicRef? Company { get; set; }
        public PublicRef? Auditor { get; set; }
        // The finding's page on the portal.
        public string Url { get; set; } = "";
    }

    public class PublicVulnerabilityDetail : PublicVulnerabilitySummary
    {
        // Full write-up, Markdown.
        public string Description { get; set; } = "";
        // Link to the original source, when the finding has one.
        public string? SourceUrl { get; set; }
    }

    public class PublicReportSummary
    {
        public int Id { get; set; }
        public string Name { get; set; } = "";
        public DateTime Date { get; set; }
        public PublicRef? Protocol { get; set; }
        public PublicRef? Company { get; set; }
        public PublicRef? Auditor { get; set; }
        public string Url { get; set; } = "";
        // The original report PDF.
        public string DownloadUrl { get; set; } = "";
    }

    public class PublicReportDetail : PublicReportSummary
    {
        public int FindingsTotal { get; set; }
        // Severity (lower case) -> number of findings.
        public Dictionary<string, int> FindingsBySeverity { get; set; } = new();
        // Up to 100 findings, newest first. Use the vulnerability search with reportId for the rest.
        public List<PublicVulnerabilitySummary> Findings { get; set; } = new();
        // The report text as Markdown. Only present when asked for; it can be long.
        public string? Content { get; set; }
    }

    public class PublicEntity
    {
        public int Id { get; set; }
        public string Name { get; set; } = "";
        public string? Website { get; set; }
        public string? Description { get; set; }
        public int ReportsCount { get; set; }
        public string Url { get; set; } = "";
    }

    public class PublicProtocol : PublicEntity
    {
        public PublicRef? Company { get; set; }
    }

    public class PublicError
    {
        public string Error { get; set; } = "";
        public string Message { get; set; } = "";
    }

    public class PublicVulnerabilityQuery
    {
        public string? Query { get; set; }
        public string? Severity { get; set; }
        public string? Category { get; set; }
        public string? Tag { get; set; }
        public string? Protocol { get; set; }
        public string? Auditor { get; set; }
        public string? Company { get; set; }
        public int? ReportId { get; set; }
        public DateTime? From { get; set; }
        public DateTime? To { get; set; }
        public int? Page { get; set; }
        public int? PageSize { get; set; }
    }

    public class PublicReportQuery
    {
        public string? Query { get; set; }
        public string? Protocol { get; set; }
        public string? Auditor { get; set; }
        public string? Company { get; set; }
        public DateTime? From { get; set; }
        public DateTime? To { get; set; }
        public int? Page { get; set; }
        public int? PageSize { get; set; }
    }
}

namespace SorobanSecurityPortalApi.Models.ViewModels
{
    // Slim report metadata for the OG summary card; never carries the heavy
    // Image/BinFile/MdFile/embedding columns.
    public record ReportSummaryMeta(string Name, string? AuditorName, string Status, DateTime LastActionAt);

    // Everything the summary card renders, plus a Signature used as the cache/ETag key.
    public record ReportSummaryStats(
        string ReportName,
        string? AuditorName,
        int Total,
        int Fixed,
        int NotFixed,
        int FixedRate,
        string Signature);
}

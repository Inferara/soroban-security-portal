using System.Globalization;
using System.Text;
using SorobanSecurityPortalApi.Models.ViewModels;

namespace SorobanSecurityPortalApi.Services.PublicApi
{
    // The name of the separate OpenAPI document for the public REST API.
    public static class PublicApiDocument
    {
        public const string Name = "public-v1";
    }

    // Operation names as they appear in the usage log. They double as the MCP tool names,
    // so statistics for the two transports line up.
    public static class PublicApiOperations
    {
        public const string SearchVulnerabilities = "search_vulnerabilities";
        public const string GetVulnerability = "get_vulnerability";
        public const string SearchReports = "search_reports";
        public const string GetReport = "get_report";
        public const string ListProtocols = "list_protocols";
        public const string ListAuditors = "list_auditors";
        public const string ListCompanies = "list_companies";

        // Short "key=value" summaries for the usage log. Only what was actually set.
        public static string? Describe(PublicVulnerabilityQuery q)
        {
            var sb = new StringBuilder();
            Append(sb, "query", q.Query);
            Append(sb, "severity", q.Severity);
            Append(sb, "category", q.Category);
            Append(sb, "tag", q.Tag);
            Append(sb, "protocol", q.Protocol);
            Append(sb, "auditor", q.Auditor);
            Append(sb, "company", q.Company);
            Append(sb, "reportId", q.ReportId?.ToString(CultureInfo.InvariantCulture));
            Append(sb, "from", q.From?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
            Append(sb, "to", q.To?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
            Append(sb, "page", q.Page?.ToString(CultureInfo.InvariantCulture));
            Append(sb, "pageSize", q.PageSize?.ToString(CultureInfo.InvariantCulture));
            return sb.Length == 0 ? null : sb.ToString();
        }

        public static string? Describe(PublicReportQuery q)
        {
            var sb = new StringBuilder();
            Append(sb, "query", q.Query);
            Append(sb, "protocol", q.Protocol);
            Append(sb, "auditor", q.Auditor);
            Append(sb, "company", q.Company);
            Append(sb, "from", q.From?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
            Append(sb, "to", q.To?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
            Append(sb, "page", q.Page?.ToString(CultureInfo.InvariantCulture));
            Append(sb, "pageSize", q.PageSize?.ToString(CultureInfo.InvariantCulture));
            return sb.Length == 0 ? null : sb.ToString();
        }

        private static void Append(StringBuilder sb, string name, string? value)
        {
            if (string.IsNullOrWhiteSpace(value)) return;
            if (sb.Length > 0) sb.Append(' ');
            // Keep one argument from crowding out the rest of the (truncated) summary.
            var trimmed = value.Trim().Replace('\n', ' ').Replace('\r', ' ');
            if (trimmed.Length > 120) trimmed = trimmed[..120] + "...";
            sb.Append(name).Append('=').Append(trimmed);
        }
    }
}

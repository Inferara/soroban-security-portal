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
        public const string RetVersions = "ret_versions";
        public const string RetDecompileAddress = "ret_decompile_address";
        public const string RetDecompileWasm = "ret_decompile_wasm";

        // The calls that run the decompiler. They are CPU heavy, so they also count against a much
        // stricter limit of their own (ret_versions is a cheap lookup and does not).
        public static bool IsDecompile(string operation) =>
            operation is RetDecompileAddress or RetDecompileWasm;

        public const string DecompilePrefix = "ret_decompile";

        public static string Describe(string address, string? network, string? version)
        {
            var sb = new StringBuilder();
            Append(sb, "address", address);
            Append(sb, "network", string.IsNullOrWhiteSpace(network) ? "mainnet" : network);
            Append(sb, "version", version);
            return sb.ToString();
        }

        // The module itself is never logged: a fingerprint is enough to tell calls apart.
        public static string DescribeWasm(string? wasmBase64, string? version, int maxBytes)
        {
            var sb = new StringBuilder();
            var text = (wasmBase64 ?? "").Trim();
            string fingerprint;
            if (text.Length == 0) fingerprint = "empty";
            else if (text.Length > (maxBytes + 2) / 3 * 4 + 8) fingerprint = $"oversized chars={text.Length}";
            else
            {
                try
                {
                    var bytes = Convert.FromBase64String(text);
                    fingerprint = $"sha256={Convert.ToHexStringLower(System.Security.Cryptography.SHA256.HashData(bytes))[..16]} bytes={bytes.Length}";
                }
                catch (FormatException)
                {
                    fingerprint = $"invalid-base64 chars={text.Length}";
                }
            }
            Append(sb, "wasm", fingerprint);
            Append(sb, "version", version);
            return sb.ToString();
        }

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

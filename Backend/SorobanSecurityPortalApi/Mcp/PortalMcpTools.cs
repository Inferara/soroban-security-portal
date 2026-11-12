using System.ComponentModel;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Serialization;
using ModelContextProtocol.Protocol;
using ModelContextProtocol.Server;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;
using SorobanSecurityPortalApi.Services.PublicApi;

namespace SorobanSecurityPortalApi.Mcp
{
    // MCP tools of the Stellar Security Portal, served at /api/mcp.
    //
    // Each tool is a thin adapter: it hands its arguments to the same IPublicApiService the
    // REST API uses, through IApiCallRunner (limits + usage log). Results are returned as JSON
    // text. To add a tool (for example the soroban-ret tools), add a method here that follows
    // the same pattern.
    [McpServerToolType]
    public class PortalMcpTools
    {
        public const string ServerName = "stellar-security-portal";

        public const string ServerInstructions =
            "The Stellar Security Portal is a public database of security audit findings (vulnerabilities) and audit "
            + "reports for Stellar / Soroban smart contracts. Use search_vulnerabilities to find known issues similar to "
            + "the code or design you are looking at, then get_vulnerability for the full write-up of a finding. "
            + "Use search_reports / get_report to explore audits of a protocol. Filters take a name or an id; "
            + "list_protocols, list_auditors and list_companies show what exists. Every item has a `url` to its page "
            + "on the portal: cite it when you refer to a finding or report.";

        private static readonly JsonSerializerOptions JsonOptions = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
            // Findings are full of code (<, >, &, quotes): keep them readable instead of \u-escaped.
            Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
        };

        private readonly IPublicApiService _service;
        private readonly IApiCallRunner _runner;

        public PortalMcpTools(IPublicApiService service, IApiCallRunner runner)
        {
            _service = service;
            _runner = runner;
        }

        [McpServerTool(Name = PublicApiOperations.SearchVulnerabilities, Title = "Search vulnerabilities", ReadOnly = true, Idempotent = true, OpenWorld = false)]
        [Description("Search security audit findings for Stellar/Soroban smart contracts. With `query` the results are ranked by "
                     + "relevance (semantic + text); without it they are listed newest first. Results are compact: call "
                     + "get_vulnerability with an id for the full description. Returns JSON: { items, total, page, pageSize, hasMore, searchMode }.")]
        public async Task<CallToolResult> SearchVulnerabilities(
            [Description("What to look for, in plain words or code terms, e.g. \"missing require_auth on admin function\". Optional.")] string? query = null,
            [Description("Filter by severity: critical, high, medium, low or note. Comma-separated for several.")] string? severity = null,
            [Description("Filter by fix status: Valid, ValidNotFixed, ValidPartiallyFixed, Acknowledged or NA. Comma-separated for several.")] string? category = null,
            [Description("Filter by tag. Comma-separated: a finding must have all of them.")] string? tag = null,
            [Description("Protocol name or id (see list_protocols).")] string? protocol = null,
            [Description("Auditor name or id (see list_auditors).")] string? auditor = null,
            [Description("Company name or id (see list_companies).")] string? company = null,
            [Description("Only findings from this report id.")] int? reportId = null,
            [Description("Only findings dated on or after this date (YYYY-MM-DD).")] DateTime? from = null,
            [Description("Only findings dated on or before this date (YYYY-MM-DD).")] DateTime? to = null,
            [Description("Page number, starting at 1.")] int? page = null,
            [Description("Items per page, 1-100. Default 20.")] int? pageSize = null)
        {
            var request = new PublicVulnerabilityQuery
            {
                Query = query, Severity = severity, Category = category, Tag = tag, Protocol = protocol,
                Auditor = auditor, Company = company, ReportId = reportId, From = from, To = to,
                Page = page, PageSize = pageSize,
            };
            return ToResult(await _runner.Run(ApiUsageSource.Mcp, PublicApiOperations.SearchVulnerabilities,
                PublicApiOperations.Describe(request), async () => await _service.SearchVulnerabilities(request)));
        }

        [McpServerTool(Name = PublicApiOperations.GetVulnerability, Title = "Get vulnerability", ReadOnly = true, Idempotent = true, OpenWorld = false)]
        [Description("Get one audit finding by id, including its full Markdown description (root cause, impact, code, recommendation), "
                     + "severity, fix status, tags, and the report, protocol and auditor it belongs to.")]
        public async Task<CallToolResult> GetVulnerability(
            [Description("The finding id, as returned by search_vulnerabilities or get_report.")] int id)
        {
            return ToResult(await _runner.Run(ApiUsageSource.Mcp, PublicApiOperations.GetVulnerability,
                $"id={id}", async () => await _service.GetVulnerability(id)));
        }

        [McpServerTool(Name = PublicApiOperations.SearchReports, Title = "Search audit reports", ReadOnly = true, Idempotent = true, OpenWorld = false)]
        [Description("Search security audit reports for Stellar/Soroban projects. With `query` the results are ranked by relevance; "
                     + "without it they are listed newest first. Returns JSON: { items, total, page, pageSize, hasMore }.")]
        public async Task<CallToolResult> SearchReports(
            [Description("Free text to look for in report names and content. Optional.")] string? query = null,
            [Description("Protocol name or id (see list_protocols).")] string? protocol = null,
            [Description("Auditor name or id (see list_auditors).")] string? auditor = null,
            [Description("Company name or id (see list_companies).")] string? company = null,
            [Description("Only reports dated on or after this date (YYYY-MM-DD).")] DateTime? from = null,
            [Description("Only reports dated on or before this date (YYYY-MM-DD).")] DateTime? to = null,
            [Description("Page number, starting at 1.")] int? page = null,
            [Description("Items per page, 1-100. Default 20.")] int? pageSize = null)
        {
            var request = new PublicReportQuery
            {
                Query = query, Protocol = protocol, Auditor = auditor, Company = company,
                From = from, To = to, Page = page, PageSize = pageSize,
            };
            return ToResult(await _runner.Run(ApiUsageSource.Mcp, PublicApiOperations.SearchReports,
                PublicApiOperations.Describe(request), async () => await _service.SearchReports(request)));
        }

        [McpServerTool(Name = PublicApiOperations.GetReport, Title = "Get audit report", ReadOnly = true, Idempotent = true, OpenWorld = false)]
        [Description("Get one audit report by id: protocol, auditor, date, a per-severity count of its findings and the findings "
                     + "themselves (compact, up to 100). Set includeContent to also get the report text as Markdown, which can be long.")]
        public async Task<CallToolResult> GetReport(
            [Description("The report id, as returned by search_reports.")] int id,
            [Description("Also return the full report text (Markdown). Off by default because it is long.")] bool includeContent = false)
        {
            return ToResult(await _runner.Run(ApiUsageSource.Mcp, PublicApiOperations.GetReport,
                $"id={id}" + (includeContent ? " includeContent=true" : ""), async () => await _service.GetReport(id, includeContent)));
        }

        [McpServerTool(Name = PublicApiOperations.ListProtocols, Title = "List protocols", ReadOnly = true, Idempotent = true, OpenWorld = false)]
        [Description("List every protocol on the portal with its id, company and number of audit reports. Use the id or name as the `protocol` filter of the search tools.")]
        public async Task<CallToolResult> ListProtocols()
        {
            return ToResult(await _runner.Run(ApiUsageSource.Mcp, PublicApiOperations.ListProtocols,
                null, async () => await _service.ListProtocols()));
        }

        [McpServerTool(Name = PublicApiOperations.ListAuditors, Title = "List auditors", ReadOnly = true, Idempotent = true, OpenWorld = false)]
        [Description("List every audit firm on the portal with its id and number of audit reports. Use the id or name as the `auditor` filter of the search tools.")]
        public async Task<CallToolResult> ListAuditors()
        {
            return ToResult(await _runner.Run(ApiUsageSource.Mcp, PublicApiOperations.ListAuditors,
                null, async () => await _service.ListAuditors()));
        }

        [McpServerTool(Name = PublicApiOperations.ListCompanies, Title = "List companies", ReadOnly = true, Idempotent = true, OpenWorld = false)]
        [Description("List every company on the portal with its id and number of audit reports. Use the id or name as the `company` filter of the search tools.")]
        public async Task<CallToolResult> ListCompanies()
        {
            return ToResult(await _runner.Run(ApiUsageSource.Mcp, PublicApiOperations.ListCompanies,
                null, async () => await _service.ListCompanies()));
        }

        // A successful call returns the JSON as text. Anything else becomes a tool result with
        // isError=true and a plain message, so the model sees why the call failed (for example
        // which limit was hit and when to retry) and can react to it.
        private static CallToolResult ToResult<T>(ApiCallOutcome<T> outcome) where T : class
        {
            var ok = outcome.Status == ApiCallStatus.Ok;
            var text = ok
                ? JsonSerializer.Serialize(outcome.Value, JsonOptions)
                : outcome.Message ?? "The call failed.";
            return new CallToolResult
            {
                IsError = !ok,
                Content = new List<ContentBlock> { new TextContentBlock { Text = text } },
            };
        }
    }
}

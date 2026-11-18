using System.Reflection;
using System.Text.Json.Nodes;
using Microsoft.OpenApi;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace SorobanSecurityPortalApi.Services.PublicApi
{
    // Hints that tell an agent gateway when to pick an operation. They are published in the
    // public OpenAPI document as `x-routing`, next to `x-mcp-tool` (the MCP tool with the same
    // behaviour) and `x-side-effecting` (always false: the public API only reads).
    public sealed record PublicApiRoute(
        string Purpose,
        string UseWhen,
        string[] ExampleQuestions,
        string[] Keywords,
        string NotFor);

    public static class PublicApiRouting
    {
        public static readonly IReadOnlyDictionary<string, PublicApiRoute> Routes = new Dictionary<string, PublicApiRoute>
        {
            [PublicApiOperations.SearchVulnerabilities] = new(
                "Search individual security audit findings in Soroban smart contract audits.",
                "The question is about known vulnerabilities, a class of bug, or the findings of a protocol, auditor or report.",
                new[]
                {
                    "Which audit findings mention missing require_auth on admin functions?",
                    "Which findings in Blend's audits were not fixed?",
                    "What rounding issues have auditors reported in Soroban vaults?",
                },
                new[] { "vulnerability", "finding", "audit", "severity", "fix status", "soroban" },
                "Whether a protocol is safe or audited in general; the portal only lists reports that were uploaded."),
            [PublicApiOperations.GetVulnerability] = new(
                "Read one audit finding in full: the auditor's write-up, severity, fix status, tags, report, protocol and auditor.",
                "A finding id is known, from a search result or from a portal link ending in /vulnerability/{id}.",
                new[]
                {
                    "What is the root cause and recommendation of finding 412?",
                    "Show the full write-up of this finding from the Stellar Security Portal.",
                },
                new[] { "finding", "write-up", "root cause", "recommendation", "vulnerability id" },
                "Looking up a finding when you do not have its id; search first."),
            [PublicApiOperations.SearchReports] = new(
                "Search published security audit reports for Stellar and Soroban projects.",
                "The question is about which audit reports exist for a protocol, auditor, company or period.",
                new[]
                {
                    "Which audit reports does the portal have for Blend?",
                    "Which Soroban audits were published in 2026?",
                    "Which reports did OtterSec write for Stellar projects?",
                },
                new[] { "audit report", "auditor", "protocol", "audit date", "soroban" },
                "Individual findings; use the vulnerability search for those."),
            [PublicApiOperations.GetReport] = new(
                "Read one audit report: protocol, auditor, date, findings per severity and the list of its findings.",
                "A report id is known, from a report search or from a portal link ending in /report/{id}.",
                new[]
                {
                    "How many high severity findings does report 84 have?",
                    "List the findings of this audit report.",
                },
                new[] { "audit report", "findings list", "severity count", "report id" },
                "Reports that are not on the portal; only uploaded and approved reports are available."),
            [PublicApiOperations.ListProtocols] = new(
                "List every protocol entry on the portal, with its company and the number of audit reports it has (which can be 0).",
                "A protocol name or id is needed for a filter, or the question is which protocols the portal knows and how many reports each has.",
                new[]
                {
                    "Which protocols have audit reports on the Stellar Security Portal?",
                    "What is the exact name of the Blend entries on the portal?",
                },
                new[] { "protocol", "project", "coverage", "filter value" },
                "Proof that a protocol was audited: an entry can have 0 reports, so check reportsCount or search the reports. It is also no complete list of Stellar protocols."),
            [PublicApiOperations.ListAuditors] = new(
                "List every audit firm entry on the portal, with the number of audit reports it has (which can be 0).",
                "An auditor name or id is needed for a filter, or the question is which firms have reports on the portal and how many.",
                new[]
                {
                    "Which audit firms have reports on the Stellar Security Portal?",
                    "How many reports on the portal are by Certora?",
                },
                new[] { "auditor", "audit firm", "security company", "filter value" },
                "Ranking or recommending audit firms. An entry can have 0 reports; check reportsCount before saying a firm audited something."),
            [PublicApiOperations.ListCompanies] = new(
                "List every company entry on the portal, with the number of audit reports across its protocols (which can be 0).",
                "A company name or id is needed for a filter, or several protocols of one company are in question.",
                new[]
                {
                    "Which companies have protocols with audit reports on the portal?",
                    "Which company is behind this protocol?",
                },
                new[] { "company", "team", "organization", "filter value" },
                "Company information beyond name, website and description. An entry can have 0 reports; check reportsCount."),
            [PublicApiOperations.ListTags] = new(
                "List the tags used on audit findings, with the number of findings for each.",
                "A tag is needed for the vulnerability search, or the question is which kinds of issue the findings are grouped by.",
                new[]
                {
                    "Which tags can I filter audit findings by?",
                    "How many findings are tagged Access Control?",
                },
                new[] { "tag", "issue class", "category of bug", "filter value" },
                "Fix status or severity; those are separate filters with fixed values."),
        };

        public static JsonObject ToJson(PublicApiRoute route) => new()
        {
            ["purpose"] = route.Purpose,
            ["useWhen"] = route.UseWhen,
            ["exampleQuestions"] = new JsonArray(route.ExampleQuestions.Select(q => (JsonNode)JsonValue.Create(q)!).ToArray()),
            ["keywords"] = new JsonArray(route.Keywords.Select(k => (JsonNode)JsonValue.Create(k)!).ToArray()),
            ["notFor"] = route.NotFor,
        };
    }

    // Names the public operation a REST action implements (a PublicApiOperations constant).
    [AttributeUsage(AttributeTargets.Method)]
    public sealed class PublicOperationAttribute : Attribute
    {
        public PublicOperationAttribute(string name) => Name = name;
        public string Name { get; }
    }

    // Writes x-mcp-tool, x-side-effecting and x-routing on each public operation.
    public class PublicApiRoutingFilter : IOperationFilter
    {
        public void Apply(OpenApiOperation operation, OperationFilterContext context)
        {
            var name = context.MethodInfo?.GetCustomAttribute<PublicOperationAttribute>()?.Name;
            if (name == null) return;
            operation.Extensions ??= new Dictionary<string, IOpenApiExtension>();
            operation.Extensions["x-mcp-tool"] = new JsonNodeExtension(JsonValue.Create(name)!);
            operation.Extensions["x-side-effecting"] = new JsonNodeExtension(JsonValue.Create(false));
            if (PublicApiRouting.Routes.TryGetValue(name, out var route))
                operation.Extensions["x-routing"] = new JsonNodeExtension(PublicApiRouting.ToJson(route));
        }
    }
}

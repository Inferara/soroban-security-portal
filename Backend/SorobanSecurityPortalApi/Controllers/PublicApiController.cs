using System.Globalization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SorobanSecurityPortalApi.Authorization;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;
using SorobanSecurityPortalApi.Services.PublicApi;
using Swashbuckle.AspNetCore.Annotations;

namespace SorobanSecurityPortalApi.Controllers
{
    // The public, read-only REST API. Same operations and data as the MCP tools at /api/mcp.
    // Requires an API key (create one on your profile page).
    [ApiController]
    [Authorize(AuthenticationSchemes = ApiKeyAuthenticationHandler.SchemeName)]
    [ApiExplorerSettings(GroupName = PublicApiDocument.Name)]
    [Route("api/public/v1")]
    [Produces("application/json")]
    public class PublicApiController : ControllerBase
    {
        private readonly IPublicApiService _service;
        private readonly IApiCallRunner _runner;

        public PublicApiController(IPublicApiService service, IApiCallRunner runner)
        {
            _service = service;
            _runner = runner;
        }

        [HttpGet("vulnerabilities")]
        [SwaggerOperation(
            Summary = "Search vulnerabilities",
            Description = "Search audit findings by text and filters. Results are compact (no description); "
                          + "fetch one finding by id for the full write-up. With `query`, results are ranked by relevance; "
                          + "without it, newest first.")]
        [ProducesResponseType(typeof(PublicVulnerabilityPage), StatusCodes.Status200OK)]
        [ProducesResponseType(typeof(PublicError), StatusCodes.Status400BadRequest)]
        [ProducesResponseType(typeof(PublicError), StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(typeof(PublicError), StatusCodes.Status429TooManyRequests)]
        public async Task<IActionResult> SearchVulnerabilities(
            [FromQuery, SwaggerParameter("Free text, for example \"reentrancy in token transfer\". Max 500 characters.")] string? query,
            [FromQuery, SwaggerParameter("critical, high, medium, low or note. Comma-separated for several.")] string? severity,
            [FromQuery, SwaggerParameter("Valid, ValidNotFixed, ValidPartiallyFixed, Acknowledged or NA. Comma-separated for several.")] string? category,
            [FromQuery, SwaggerParameter("Tag name. Comma-separated: the finding must have all of them.")] string? tag,
            [FromQuery, SwaggerParameter("Protocol id or name.")] string? protocol,
            [FromQuery, SwaggerParameter("Auditor id or name.")] string? auditor,
            [FromQuery, SwaggerParameter("Company id or name.")] string? company,
            [FromQuery, SwaggerParameter("Only findings from this report.")] int? reportId,
            [FromQuery, SwaggerParameter("Finding date from (ISO 8601, UTC).")] DateTime? from,
            [FromQuery, SwaggerParameter("Finding date to (ISO 8601, UTC).")] DateTime? to,
            [FromQuery, SwaggerParameter("Page number, starting at 1.")] int? page,
            [FromQuery, SwaggerParameter("Items per page, 1-100. Default 20.")] int? pageSize)
        {
            var request = new PublicVulnerabilityQuery
            {
                Query = query, Severity = severity, Category = category, Tag = tag, Protocol = protocol,
                Auditor = auditor, Company = company, ReportId = reportId, From = from, To = to,
                Page = page, PageSize = pageSize,
            };
            return ToResult(await _runner.Run(ApiUsageSource.Rest, PublicApiOperations.SearchVulnerabilities,
                PublicApiOperations.Describe(request), async () => await _service.SearchVulnerabilities(request)));
        }

        [HttpGet("vulnerabilities/{id:int}")]
        [SwaggerOperation(Summary = "Get one vulnerability", Description = "The full finding, including its Markdown description.")]
        [ProducesResponseType(typeof(PublicVulnerabilityDetail), StatusCodes.Status200OK)]
        [ProducesResponseType(typeof(PublicError), StatusCodes.Status404NotFound)]
        [ProducesResponseType(typeof(PublicError), StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(typeof(PublicError), StatusCodes.Status429TooManyRequests)]
        public async Task<IActionResult> GetVulnerability(int id)
        {
            return ToResult(await _runner.Run(ApiUsageSource.Rest, PublicApiOperations.GetVulnerability,
                $"id={id}", async () => await _service.GetVulnerability(id)));
        }

        [HttpGet("reports")]
        [SwaggerOperation(
            Summary = "Search audit reports",
            Description = "Search audit reports by text and filters. With `query`, results are ranked by relevance; without it, newest first.")]
        [ProducesResponseType(typeof(PublicPage<PublicReportSummary>), StatusCodes.Status200OK)]
        [ProducesResponseType(typeof(PublicError), StatusCodes.Status400BadRequest)]
        [ProducesResponseType(typeof(PublicError), StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(typeof(PublicError), StatusCodes.Status429TooManyRequests)]
        public async Task<IActionResult> SearchReports(
            [FromQuery, SwaggerParameter("Free text. Max 500 characters.")] string? query,
            [FromQuery, SwaggerParameter("Protocol id or name.")] string? protocol,
            [FromQuery, SwaggerParameter("Auditor id or name.")] string? auditor,
            [FromQuery, SwaggerParameter("Company id or name.")] string? company,
            [FromQuery, SwaggerParameter("Report date from (ISO 8601, UTC).")] DateTime? from,
            [FromQuery, SwaggerParameter("Report date to (ISO 8601, UTC).")] DateTime? to,
            [FromQuery, SwaggerParameter("Page number, starting at 1.")] int? page,
            [FromQuery, SwaggerParameter("Items per page, 1-100. Default 20.")] int? pageSize)
        {
            var request = new PublicReportQuery
            {
                Query = query, Protocol = protocol, Auditor = auditor, Company = company,
                From = from, To = to, Page = page, PageSize = pageSize,
            };
            return ToResult(await _runner.Run(ApiUsageSource.Rest, PublicApiOperations.SearchReports,
                PublicApiOperations.Describe(request), async () => await _service.SearchReports(request)));
        }

        [HttpGet("reports/{id:int}")]
        [SwaggerOperation(
            Summary = "Get one audit report",
            Description = "Report details with its findings (up to 100, compact) and a per-severity count. "
                          + "Pass `includeContent=true` to also get the report text as Markdown; it can be long.")]
        [ProducesResponseType(typeof(PublicReportDetail), StatusCodes.Status200OK)]
        [ProducesResponseType(typeof(PublicError), StatusCodes.Status404NotFound)]
        [ProducesResponseType(typeof(PublicError), StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(typeof(PublicError), StatusCodes.Status429TooManyRequests)]
        public async Task<IActionResult> GetReport(int id, [FromQuery] bool includeContent = false)
        {
            return ToResult(await _runner.Run(ApiUsageSource.Rest, PublicApiOperations.GetReport,
                $"id={id}" + (includeContent ? " includeContent=true" : ""), async () => await _service.GetReport(id, includeContent)));
        }

        [HttpGet("protocols")]
        [SwaggerOperation(Summary = "List protocols", Description = "Every protocol on the portal, with its company and the number of audit reports.")]
        [ProducesResponseType(typeof(List<PublicProtocol>), StatusCodes.Status200OK)]
        [ProducesResponseType(typeof(PublicError), StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(typeof(PublicError), StatusCodes.Status429TooManyRequests)]
        public async Task<IActionResult> ListProtocols()
        {
            return ToResult(await _runner.Run(ApiUsageSource.Rest, PublicApiOperations.ListProtocols,
                null, async () => await _service.ListProtocols()));
        }

        [HttpGet("auditors")]
        [SwaggerOperation(Summary = "List auditors", Description = "Every audit firm on the portal, with the number of audit reports.")]
        [ProducesResponseType(typeof(List<PublicEntity>), StatusCodes.Status200OK)]
        [ProducesResponseType(typeof(PublicError), StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(typeof(PublicError), StatusCodes.Status429TooManyRequests)]
        public async Task<IActionResult> ListAuditors()
        {
            return ToResult(await _runner.Run(ApiUsageSource.Rest, PublicApiOperations.ListAuditors,
                null, async () => await _service.ListAuditors()));
        }

        [HttpGet("companies")]
        [SwaggerOperation(Summary = "List companies", Description = "Every company on the portal, with the number of audit reports across its protocols.")]
        [ProducesResponseType(typeof(List<PublicEntity>), StatusCodes.Status200OK)]
        [ProducesResponseType(typeof(PublicError), StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(typeof(PublicError), StatusCodes.Status429TooManyRequests)]
        public async Task<IActionResult> ListCompanies()
        {
            return ToResult(await _runner.Run(ApiUsageSource.Rest, PublicApiOperations.ListCompanies,
                null, async () => await _service.ListCompanies()));
        }

        private IActionResult ToResult<T>(ApiCallOutcome<T> outcome) where T : class
        {
            switch (outcome.Status)
            {
                case ApiCallStatus.Ok:
                    return Ok(outcome.Value);
                case ApiCallStatus.NotFound:
                    return NotFound(new PublicError { Error = "not_found", Message = outcome.Message ?? "Not found." });
                case ApiCallStatus.BadRequest:
                    return BadRequest(new PublicError { Error = "bad_request", Message = outcome.Message ?? "Bad request." });
                case ApiCallStatus.RateLimited:
                    Response.Headers.RetryAfter = outcome.RetryAfterSeconds.ToString(CultureInfo.InvariantCulture);
                    return StatusCode(StatusCodes.Status429TooManyRequests,
                        new PublicError { Error = "rate_limited", Message = outcome.Message ?? "Too many requests." });
                case ApiCallStatus.Disabled:
                    return StatusCode(StatusCodes.Status503ServiceUnavailable,
                        new PublicError { Error = "disabled", Message = outcome.Message ?? "Temporarily disabled." });
                case ApiCallStatus.Unauthorized:
                    return Unauthorized(new PublicError { Error = "unauthorized", Message = outcome.Message ?? "Unauthorized." });
                default:
                    return StatusCode(StatusCodes.Status500InternalServerError,
                        new PublicError { Error = "internal_error", Message = outcome.Message ?? "Internal error." });
            }
        }
    }
}

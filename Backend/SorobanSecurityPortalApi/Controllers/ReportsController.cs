using System.Text.Json;
using SorobanSecurityPortalApi.Services.ControllersServices;
using SorobanSecurityPortalApi.Services.AgentServices;
using Microsoft.AspNetCore.Mvc;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Common.Security;
using SorobanSecurityPortalApi.Models.ViewModels;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Common.Extensions;
using SorobanSecurityPortalApi.Authorization.Attributes;

namespace SorobanSecurityPortalApi.Controllers
{
    [ApiController]
    [Route("api/v1/reports")]
    public class ReportsController : ControllerBase
    {
        private readonly IReportService _reportService;
        private readonly IVulnerabilityExtractionService _extractionService;
        private readonly UserContextAccessor _userContextAccessor;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly ILogger<ReportsController> _logger;
        private readonly IReportImageService _reportImageService;

        // Maximum PDF size for URL downloads (50MB)
        private const int MaxPdfSizeBytes = 50 * 1024 * 1024;

        public ReportsController(
            IReportService reportService,
            IVulnerabilityExtractionService extractionService,
            UserContextAccessor userContextAccessor,
            IHttpClientFactory httpClientFactory,
            ILogger<ReportsController> logger,
            IReportImageService reportImageService)
        {
            _reportService = reportService;
            _extractionService = extractionService;
            _userContextAccessor = userContextAccessor;
            _httpClientFactory = httpClientFactory;
            _logger = logger;
            _reportImageService = reportImageService;
        }

        [HttpPost]
        public async Task<IActionResult> Search([FromBody] ReportSearchViewModel? reportSearch)
        {
            var result = await _reportService.Search(reportSearch);
            return Ok(result);
        }

        [RoleAuthorize(Role.Admin, Role.Moderator, Role.Contributor, Role.User)]
        [HttpGet("{reportId}/download")]
        public async Task<IActionResult> GetFile(int reportId)
        {
            var result = await _reportService.Get(reportId);
            if (!CanDownloadReport(result))
            {
                return Forbid();
            }

            if (result.BinFile == null || result.BinFile.Length == 0)
            {
                return BadRequest("Report is not found.");
            }
            return File(result.BinFile, "application/pdf", $"{result.Name}.pdf");
        }

        private bool CanDownloadReport(ReportViewModel report)
        {
            return report.Status == ReportModelStatus.Approved
                || UserHasAnyRole(Role.Admin, Role.Moderator, Role.Contributor);
        }

        private bool UserHasAnyRole(params Role[] roles)
        {
            return roles.Any(role => User.IsInRole(role.ToString()));
        }

        [HttpGet("{reportId}/image.png")]
        public async Task<IActionResult> GetImage(int reportId)
        {
            // Cheap metadata query first (timestamp only, never de-TOASTs the image/PDF bytes).
            var meta = await _reportImageService.GetImageMetaAsync(reportId);
            if (meta == null)
                return NotFound();

            Response.Headers.ETag = meta.ETag;
            Response.Headers.LastModified = meta.LastModified.ToString("R");
            Response.Headers.CacheControl = "public, max-age=3600";

            // Honor conditional requests without ever fetching the image bytes.
            var ifNoneMatch = Request.Headers.IfNoneMatch.ToString();
            if (!string.IsNullOrEmpty(ifNoneMatch) && ifNoneMatch.Contains(meta.ETag))
                return StatusCode(StatusCodes.Status304NotModified);

            var content = await _reportImageService.GetImageContentAsync(reportId);
            if (content == null)
                return NotFound();

            return File(content.Bytes, "image/webp");
        }

        [RoleAuthorize(Role.Admin, Role.Moderator, Role.Contributor)]
        [HttpPost("add")]
        [RequestSizeLimit(60_000_000)]
        public async Task<IActionResult> Add([FromForm] string report, [FromForm] IFormFile? file = null)
        {
            if (string.IsNullOrWhiteSpace(report))
                return BadRequest("Report data is required.");

            AddReportViewModel? addReportViewModel;
            try
            {
                addReportViewModel = report.JsonGet<AddReportViewModel>();
            }
            catch (JsonException ex)
            {
                return BadRequest("Invalid report JSON: " + ex.Message);
            }

            if (addReportViewModel == null)
                return BadRequest("Parsed report is null.");
            var userLoginId = await _userContextAccessor.GetLoginIdAsync();

            var parsedReport = new ReportViewModel
            {
                Id = 0,
                Name = addReportViewModel.Title,
                Date = addReportViewModel.Date,
                Status = ReportModelStatus.New,
                ProtocolId = addReportViewModel.ProtocolId,
                AuditorId = addReportViewModel.AuditorId,
                CreatedBy = userLoginId,
            };
            if (file != null && file.Length > 0)
            {
                if (!await _userContextAccessor.IsLoginIdAdmin(userLoginId) && file.Length > 10 * 1024 * 1024)
                {
                    return BadRequest("Report file size cannot exceed 10MB");
                }
                using var memoryStream = new MemoryStream();
                await file.CopyToAsync(memoryStream);
                parsedReport.BinFile = memoryStream.ToArray();
            }
            else if (!string.IsNullOrWhiteSpace(addReportViewModel.Url))
            {
                // Validate URL for SSRF protection
                if (!UrlValidator.IsUrlSafeForFetch(addReportViewModel.Url, out var urlError))
                {
                    _logger.LogWarning("Report URL validation failed: {Error}, URL: {Url}", urlError, addReportViewModel.Url);
                    return BadRequest(urlError);
                }

                // Download the file from the URL using configured HttpClient
                var httpClient = _httpClientFactory.CreateClient(HttpClients.ReportFetchClient);
                try
                {
                    using var response = await httpClient.GetAsync(addReportViewModel.Url, HttpCompletionOption.ResponseHeadersRead);

                    if (!response.IsSuccessStatusCode)
                    {
                        _logger.LogWarning("Failed to download report from URL: {StatusCode}", response.StatusCode);
                        return BadRequest("Failed to download file from the specified URL.");
                    }

                    // Check Content-Length before downloading
                    var contentLength = response.Content.Headers.ContentLength;
                    if (contentLength.HasValue && contentLength.Value > MaxPdfSizeBytes)
                    {
                        _logger.LogWarning("Report URL content too large: {Size} bytes", contentLength.Value);
                        return BadRequest("File size exceeds maximum allowed size (50MB).");
                    }

                    // Read with streaming and size limit protection
                    await using var stream = await response.Content.ReadAsStreamAsync();
                    using var memoryStream = new MemoryStream();
                    var buffer = new byte[8192];
                    int bytesRead;
                    long totalBytesRead = 0;

                    while ((bytesRead = await stream.ReadAsync(buffer)) > 0)
                    {
                        totalBytesRead += bytesRead;
                        if (totalBytesRead > MaxPdfSizeBytes)
                        {
                            _logger.LogWarning("Report download exceeded size limit during transfer");
                            return BadRequest("File size exceeds maximum allowed size (50MB).");
                        }
                        await memoryStream.WriteAsync(buffer.AsMemory(0, bytesRead));
                    }

                    parsedReport.BinFile = memoryStream.ToArray();

                    // Validate that the downloaded content is actually a PDF
                    if (!parsedReport.BinFile.IsPdf())
                    {
                        return BadRequest("The file downloaded from the URL is not a valid PDF.");
                    }
                }
                catch (TaskCanceledException)
                {
                    _logger.LogWarning("Report download timed out: {Url}", addReportViewModel.Url);
                    return BadRequest("Request timed out while downloading file.");
                }
                catch (HttpRequestException ex)
                {
                    _logger.LogWarning(ex, "HTTP error downloading report from URL: {Url}", addReportViewModel.Url);
                    return BadRequest("Error downloading file from URL.");
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Unexpected error downloading report from URL: {Url}", addReportViewModel.Url);
                    return BadRequest("Error downloading file from URL.");
                }
            }
            else
            {
                return BadRequest("No Report uploaded and no Url specified.");
            }
            var result = await _reportService.Add(parsedReport);
            return Ok(result);
        }

        [RoleAuthorize(Role.Admin, Role.Moderator)]
        [HttpPost("{reportId}/approve")]
        public async Task<IActionResult> Approve(int reportId)
        {
            var result = await _reportService.Approve(reportId);
            if (result is Result<bool, string>.Ok)
                return Ok();
            else if (result is Result<bool, string>.Err err)
                return BadRequest(err.Error);
            else
                throw new InvalidOperationException("Unexpected result type");
        }

        [RoleAuthorize(Role.Admin, Role.Moderator)]
        [HttpPost("{reportId}/reject")]
        public async Task<IActionResult> Reject(int reportId)
        {
            var result = await _reportService.Reject(reportId);
            if (result is Result<bool, string>.Ok)
                return Ok();
            else if (result is Result<bool, string>.Err err)
                return BadRequest(err.Error);
            else
                throw new InvalidOperationException("Unexpected result type");
        }

        [RoleAuthorize(Role.Admin)]
        [HttpDelete("{reportId}")]
        public async Task<IActionResult> Remove(int reportId)
        {
             await _reportService.Remove(reportId);
            return Ok();
        }

        [HttpGet("{reportId}")]
        public async Task<IActionResult> Get(int reportId)
        {
            var result = await _reportService.GetPublic(reportId);
            if (result == null)
                return NotFound();
            result.Image = null;
            result.BinFile = null;
            return Ok(result);
        }

        [RoleAuthorize(Role.Admin, Role.Moderator)]
        [HttpPut("{reportId}")]
        public async Task<IActionResult> Update(int reportId, [FromBody] ReportViewModel report)
        {
            var result = await _reportService.Update(report);
            return Ok(result);
        }

        [HttpGet]
        public async Task<IActionResult> GetList()
        {
            var result = await _reportService.GetList();
            return Ok(result);
        }

        // Returns ALL reports including hidden/deleted/unapproved — admin/moderator dashboard only.
        // The public site browses via the Search endpoint and the filtered GetList, never this one.
        [RoleAuthorize(Role.Admin, Role.Moderator)]
        [HttpGet("all")]
        public async Task<IActionResult> GetListAll()
        {
            var result = await _reportService.GetList(true);
            return Ok(result);
        }

        [HttpGet("statistics/changes")]
        public async Task<IActionResult> GetStatisticsChanges()
        {
            var result = await _reportService.GetStatisticsChanges();
            return Ok(result);
        }

        /// <summary>
        /// Extracts vulnerabilities from a report using AI-powered multi-agent analysis.
        /// </summary>
        /// <param name="reportId">The ID of the report to extract vulnerabilities from.</param>
        /// <param name="ct">Cancellation token.</param>
        /// <returns>Extraction result with statistics.</returns>
        [RoleAuthorize(Role.Admin, Role.Moderator)]
        [HttpPost("{reportId}/extract-vulnerabilities")]
        public async Task<IActionResult> ExtractVulnerabilities(int reportId, CancellationToken ct)
        {
            var result = await _extractionService.ExtractVulnerabilitiesAsync(reportId, null, ct);
            return result switch
            {
                Result<VulnerabilityExtractionResultViewModel, string>.Ok ok => Ok(ok.Value),
                Result<VulnerabilityExtractionResultViewModel, string>.Err err => BadRequest(err.Error),
                _ => throw new InvalidOperationException("Unexpected result type")
            };
        }
    }
}

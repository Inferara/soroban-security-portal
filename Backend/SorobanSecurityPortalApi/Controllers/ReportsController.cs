using System.Text.Json;
using SorobanSecurityPortalApi.Services.ControllersServices;
using Microsoft.AspNetCore.Mvc;
using SorobanSecurityPortalApi.Common;
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
        private readonly UserContextAccessor _userContextAccessor;

        public ReportsController(IReportService reportService,
            UserContextAccessor userContextAccessor)
        {
            _reportService = reportService;
            _userContextAccessor = userContextAccessor;
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
            if (result.BinFile == null || result.BinFile.Length == 0)
            {
                return BadRequest("Report is not found.");
            }
            return File(result.BinFile, "application/pdf", $"{result.Name}.pdf");
        }

        [HttpGet("{reportId}/image.png")]
        public async Task<IActionResult> GetImage(int reportId)
        {
            var result = await _reportService.Get(reportId);
            if (result.Image == null || result.Image.Length == 0)
            {
                return BadRequest("Report is not found.");
            }
            return File(result.Image, "image/png", $"image.png");
        }

        [RoleAuthorize(Role.Admin, Role.Moderator, Role.Contributor)]
        [HttpPost("add")]
        [RequestSizeLimit(10_000_000)]
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
                using var memoryStream = new MemoryStream();
                await file.CopyToAsync(memoryStream);
                parsedReport.BinFile = memoryStream.ToArray();
            }
            else if (!string.IsNullOrWhiteSpace(addReportViewModel.Url))
            {
                // Download the file from the URL
                using var httpClient = new HttpClient();
                try
                {
                    var response = await httpClient.GetAsync(addReportViewModel.Url);
                    if (response.IsSuccessStatusCode)
                    {
                        parsedReport.BinFile = await response.Content.ReadAsByteArrayAsync();
                        // Implement check if the file is a PDF
                        if (!parsedReport.BinFile.IsPdf())
                        {
                            return BadRequest("The file downloaded from the URL is not a valid PDF.");
                        }
                    }
                    else
                    {
                        return BadRequest("Failed to download file from the specified URL.");
                    }
                }
                catch (Exception ex)
                {
                    return BadRequest("Error downloading file from URL: " + ex.Message);
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
            var result = await _reportService.Get(reportId);
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
    }
}

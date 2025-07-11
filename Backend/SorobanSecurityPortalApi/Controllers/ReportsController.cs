using System.Text.Json;
using SorobanSecurityPortalApi.Services.ControllersServices;
using Microsoft.AspNetCore.Mvc;
using SorobanSecurityPortalApi.Models.ViewModels;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Common.Extensions;

namespace SorobanSecurityPortalApi.Controllers
{
    [ApiController]
    [Route("api/v1/reports")]
    public class ReportsController : ControllerBase
    {
        private readonly IReportService _reportService;

        public ReportsController(IReportService reportService)
        {
            _reportService = reportService;
        }

        [HttpPost]
        public async Task<IActionResult> Search([FromBody] ReportSearchViewModel? reportSearch)
        {
            var result = await _reportService.Search(reportSearch);
            return Ok(result);
        }

        [HttpGet("{reportId}/download")]
        public async Task<IActionResult> GetFile(int reportId)
        {
            var result = await _reportService.GetBinFile(reportId);
            if (result == null || result.Length == 0)
            {
                return NotFound();
            }
            return File(result, "application/pdf", "report.pdf");
        }
        
        [HttpPost("add")]
        [RequestSizeLimit(10_000_000)]
        public async Task<IActionResult> Add([FromForm] string report, [FromForm] IFormFile? file = null)
        {
            if (string.IsNullOrWhiteSpace(report))
                return BadRequest("Report data is required.");

            AddReportViewModel? addReportViewModel;
            try
            {
                addReportViewModel = report.JsonGet<AddReportViewModel>(); // JsonSerializer.Deserialize<AddReportViewModel>(report);
            }
            catch (JsonException ex)
            {
                return BadRequest("Invalid report JSON: " + ex.Message);
            }

            if (addReportViewModel == null)
                return BadRequest("Parsed report is null.");

            var parsedReport = new ReportViewModel
            {
                Id = 0,
                Name = addReportViewModel.Title,
                Date = DateTime.UtcNow,
                Status = ReportModelStatus.New 
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


        [HttpPost("{reportId}/approve")]
        public async Task<IActionResult> Approve(int reportId)
        {
            await _reportService.Approve(reportId);
            return Ok();
        }

        [HttpPost("{reportId}/reject")]
        public async Task<IActionResult> Reject(int reportId)
        {
            await _reportService.Reject(reportId);
            return Ok();
        }

        [HttpDelete("{reportId}")]
        public async Task<IActionResult> Remove(int reportId)
        {
             await _reportService.Remove(reportId);
            return Ok();
        }

        [HttpGet]
        public async Task<IActionResult> GetList()
        {
            var result = await _reportService.GetList();
            return Ok(result);
        }
    }
}

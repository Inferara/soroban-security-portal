using System.Text.Json;
using SorobanSecurityPortalApi.Services.ControllersServices;
using Microsoft.AspNetCore.Mvc;
using SorobanSecurityPortalApi.Common.Extensions;
using SorobanSecurityPortalApi.Models.ViewModels;
using SorobanSecurityPortalApi.Authorization.Attributes;

namespace SorobanSecurityPortalApi.Controllers
{
    [ApiController]
    [Route("api/v1/vulnerabilities")]
    public class VulnerabilitiesController : ControllerBase
    {
        private readonly IVulnerabilityService _vulnerabilityService;

        public VulnerabilitiesController(IVulnerabilityService vulnerabilityService)
        {
            _vulnerabilityService = vulnerabilityService;
        }

        [HttpGet("severities")]
        public async Task<IActionResult> ListSeverities()
        {
            var result = await _vulnerabilityService.ListSeverities();
            return Ok(result);
        }

        [HttpGet("sources")]
        public async Task<IActionResult> ListSources()
        {
            var result = await _vulnerabilityService.ListSources();
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> Search([FromBody] VulnerabilitySearchViewModel? vulnerabilitySearch)
        {
            var result = await _vulnerabilityService.Search(vulnerabilitySearch);
            return Ok(result);
        }

        [HttpPost("total")]
        public async Task<IActionResult> SearchTotal([FromBody] VulnerabilitySearchViewModel? vulnerabilitySearch)
        {
            var result = await _vulnerabilityService.SearchTotal(vulnerabilitySearch);
            return Ok(result);
        }

        [RoleAuthorize(Role.Admin, Role.Moderator, Role.Contributor)]
        [HttpPost("add")]
        [RequestSizeLimit(25_000_000)]
        public async Task<IActionResult> Add([FromForm] string vulnerability, [FromForm] IFormFile[]? images = null)
        {
            if (string.IsNullOrWhiteSpace(vulnerability))
                return BadRequest("Report data is required.");

            VulnerabilityViewModel? vulnerabilityModel;
            try
            {
                vulnerabilityModel = vulnerability.JsonGet<VulnerabilityViewModel>();
            }
            catch (JsonException ex)
            {
                return BadRequest("Invalid vulnerability JSON: " + ex.Message);
            }

            if (vulnerability == null)
                return BadRequest("Parsed vulnerability is null.");

            var files = new List<FileViewModel>();
            if (images != null && images.Length > 0)
            {
                foreach (var file in images)
                {
                    if (file.Length > 0)
                    {
                        using var memoryStream = new MemoryStream();
                        await file.CopyToAsync(memoryStream);
                        files.Add(new FileViewModel
                        {
                            ContainerGuid = vulnerabilityModel.PicturesContainerGuid,
                            Date = DateTime.UtcNow,
                            Name = file.FileName,
                            Type = file.ContentType,
                            BinFile = memoryStream.ToArray()
                        });
                    }
                }
            }
            var result = await _vulnerabilityService.Add(vulnerabilityModel, files);
            return Ok(result);
        }

        [RoleAuthorize(Role.Admin, Role.Moderator)]
        [HttpPost("{vulnerabilityId}/approve")]
        public async Task<IActionResult> Approve(int vulnerabilityId)
        {
            await _vulnerabilityService.Approve(vulnerabilityId);
            return Ok();
        }

        [RoleAuthorize(Role.Admin, Role.Moderator)]
        [HttpPost("{vulnerabilityId}/reject")]
        public async Task<IActionResult> Reject(int vulnerabilityId)
        {
            await _vulnerabilityService.Reject(vulnerabilityId);
            return Ok();
        }

        [RoleAuthorize(Role.Admin, Role.Moderator)]
        [HttpDelete("{vulnerabilityId}")]
        public async Task<IActionResult> Remove(int vulnerabilityId)
        {
            await _vulnerabilityService.Remove(vulnerabilityId);
            return Ok();
        }

        [HttpGet("{vulnerabilityId}")]
        public async Task<IActionResult> Get(int vulnerabilityId)
        {
            var result = await _vulnerabilityService.Get(vulnerabilityId);
            return Ok(result);
        }

        [RoleAuthorize(Role.Admin, Role.Moderator)]
        [HttpPut("{vulnerabilityId}")]
        [RequestSizeLimit(25_000_000)]
        public async Task<IActionResult> Update([FromForm] string vulnerability, [FromForm] IFormFile[]? images = null)
        {
            if (string.IsNullOrWhiteSpace(vulnerability))
                return BadRequest("Report data is required.");

            VulnerabilityViewModel? vulnerabilityModel;
            try
            {
                vulnerabilityModel = vulnerability.JsonGet<VulnerabilityViewModel>();
            }
            catch (JsonException ex)
            {
                return BadRequest("Invalid vulnerability JSON: " + ex.Message);
            }

            if (vulnerability == null)
                return BadRequest("Parsed vulnerability is null.");

            var files = new List<FileViewModel>();
            if (images != null && images.Length > 0)
            {
                foreach (var file in images)
                {
                    if (file.Length > 0)
                    {
                        using var memoryStream = new MemoryStream();
                        await file.CopyToAsync(memoryStream);
                        files.Add(new FileViewModel
                        {
                            ContainerGuid = vulnerabilityModel.PicturesContainerGuid,
                            Date = DateTime.UtcNow,
                            Name = file.FileName,
                            Type = file.ContentType,
                            BinFile = memoryStream.ToArray()
                        });
                    }
                }
            }
            var result = await _vulnerabilityService.Update(vulnerabilityModel, files);
            return Ok(result);
        }

        [HttpGet]
        public async Task<IActionResult> GetList()
        {
            var result = await _vulnerabilityService.GetList();
            return Ok(result);
        }
    }
}

using SorobanSecurityPortalApi.Services.ControllersServices;
using Microsoft.AspNetCore.Mvc;
using SorobanSecurityPortalApi.Models.ViewModels;

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

        [HttpGet("categories")]
        public async Task<IActionResult> ListCategories()
        {
            var result = await _vulnerabilityService.ListCategories();
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> Search([FromBody] VulnerabilitySearchViewModel? vulnerabilitySearch)
        {
            var result = await _vulnerabilityService.Search(vulnerabilitySearch);
            return Ok(result);
        }

        [HttpPost("add")]
        public async Task<IActionResult> Add([FromBody] VulnerabilityViewModel vulnerability)
        {
            if (vulnerability == null)
            {
                return BadRequest("Vulnerability data is required.");
            }
            var result = await _vulnerabilityService.Add(vulnerability);
            return Ok(result);
        }

        [HttpPost("{vulnerabilityId}/approve")]
        public async Task<IActionResult> Approve(int vulnerabilityId)
        {
            await _vulnerabilityService.Approve(vulnerabilityId);
            return Ok();
        }

        [HttpPost("{vulnerabilityId}/reject")]
        public async Task<IActionResult> Reject(int vulnerabilityId)
        {
            await _vulnerabilityService.Reject(vulnerabilityId);
            return Ok();
        }

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

        [HttpPut("{vulnerabilityId}")]
        public async Task<IActionResult> Update(int vulnerabilityId, [FromBody] VulnerabilityViewModel vulnerability)
        {
            var result = await _vulnerabilityService.Update(vulnerability);
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

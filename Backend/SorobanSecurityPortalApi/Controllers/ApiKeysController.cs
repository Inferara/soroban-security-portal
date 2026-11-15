using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SorobanSecurityPortalApi.Authorization.Attributes;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Models.ViewModels;
using SorobanSecurityPortalApi.Services.PublicApi;

namespace SorobanSecurityPortalApi.Controllers
{
    // Management of API keys for the public surface. Needs a normal portal session:
    // an API key cannot be used to create, list or revoke keys.
    [ApiController]
    [Route("api/v1/api-keys")]
    public class ApiKeysController : ControllerBase
    {
        private readonly IApiKeyService _service;

        public ApiKeysController(IApiKeyService service)
        {
            _service = service;
        }

        [HttpGet("limits")]
        [Authorize]
        public IActionResult Limits() => Ok(_service.GetLimits());

        [HttpGet]
        [Authorize]
        public async Task<IActionResult> List() => Ok(await _service.ListMine());

        // The response is the only time the full key is returned.
        [HttpPost]
        [Authorize]
        public async Task<IActionResult> Create([FromBody] CreateApiKeyRequest? request)
        {
            var result = await _service.CreateMine(request);
            return result switch
            {
                Result<CreatedApiKeyViewModel, string>.Ok ok => Ok(ok.Value),
                Result<CreatedApiKeyViewModel, string>.Err err => BadRequest(new { message = err.Error }),
                _ => throw new InvalidOperationException("Unexpected result type"),
            };
        }

        [HttpDelete("{id:int}")]
        [Authorize]
        public async Task<IActionResult> Revoke(int id)
        {
            return await _service.RevokeMine(id) ? NoContent() : NotFound(new { message = "API key not found." });
        }

        // ---- admin ----

        [RoleAuthorize(Role.Admin)]
        [HttpGet("all")]
        public async Task<IActionResult> ListAll() => Ok(await _service.ListAll());

        [RoleAuthorize(Role.Admin)]
        [HttpPost("service")]
        public async Task<IActionResult> CreateService([FromBody] CreateServiceApiKeyRequest? request)
        {
            var result = await _service.CreateService(request);
            return result switch
            {
                Result<CreatedApiKeyViewModel, string>.Ok ok => Ok(ok.Value),
                Result<CreatedApiKeyViewModel, string>.Err err => BadRequest(new { message = err.Error }),
                _ => throw new InvalidOperationException("Unexpected result type"),
            };
        }

        [RoleAuthorize(Role.Admin)]
        [HttpDelete("all/{id:int}")]
        public async Task<IActionResult> RevokeAny(int id)
        {
            return await _service.RevokeAny(id) ? NoContent() : NotFound(new { message = "API key not found." });
        }

        [RoleAuthorize(Role.Admin)]
        [HttpGet("usage/statistics")]
        public async Task<IActionResult> UsageStatistics([FromQuery] int days = 30) => Ok(await _service.GetStatistics(days));

        // Admin only: the export includes callers' search text.
        [RoleAuthorize(Role.Admin)]
        [HttpGet("usage/export.csv")]
        public async Task<IActionResult> UsageExport([FromQuery] int days = 30)
        {
            var export = await _service.ExportCsv(days);
            // The file itself stays plain CSV; a cut-off export is flagged in a header.
            if (export.Truncated) Response.Headers["X-Export-Truncated"] = "true";
            return File(Encoding.UTF8.GetBytes(export.Csv), "text/csv", $"api-usage-last-{Math.Clamp(days, 1, ApiKeyService.MaxStatisticsDays)}-days.csv");
        }
    }
}

using SorobanSecurityPortalApi.Services.ControllersServices;
using Microsoft.AspNetCore.Mvc;
using SorobanSecurityPortalApi.Models.ViewModels;
using SorobanSecurityPortalApi.Authorization.Attributes;
using SorobanSecurityPortalApi.Common;

namespace SorobanSecurityPortalApi.Controllers
{
    [ApiController]
    [Route("api/v1/protocols")]
    public class ProtocolController : ControllerBase
    {
        private readonly IProtocolService _protocolService;

        public ProtocolController(IProtocolService protocolService)
        {
            _protocolService = protocolService;
        }

        [RoleAuthorize(Role.Admin, Role.Moderator)]
        [HttpPost]
        public async Task<IActionResult> Add([FromForm] string protocolData, [FromForm] IFormFile? image = null)
        {
            var jsonOptions = new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true };
            var protocolViewModel = System.Text.Json.JsonSerializer.Deserialize<ProtocolViewModel>(protocolData, jsonOptions);
            if (protocolViewModel == null)
            {
                return BadRequest("Invalid protocol data.");
            }

            if (image != null && image.Length > 0)
            {
                using var memoryStream = new MemoryStream();
                await image.CopyToAsync(memoryStream);
                protocolViewModel.ImageData = memoryStream.ToArray();
            }

            var result = await _protocolService.Add(protocolViewModel);
            return Ok(result);
        }

        [RoleAuthorize(Role.Admin, Role.Moderator)]
        [HttpPut]
        public async Task<IActionResult> Update([FromForm] string protocolData, [FromForm] IFormFile? image = null)
        {
            var jsonOptions = new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true };
            var protocolViewModel = System.Text.Json.JsonSerializer.Deserialize<ProtocolViewModel>(protocolData, jsonOptions);
            if (protocolViewModel == null)
            {
                return BadRequest("Invalid protocol data.");
            }

            if (image != null && image.Length > 0)
            {
                using var memoryStream = new MemoryStream();
                await image.CopyToAsync(memoryStream);
                protocolViewModel.ImageData = memoryStream.ToArray();
            }

            var result = await _protocolService.Update(protocolViewModel);
            if (result is Result<ProtocolViewModel, string>.Ok ok)
                return Ok(ok.Value);
            else if (result is Result<ProtocolViewModel, string>.Err err)
                return BadRequest(err.Error);
            else
                throw new InvalidOperationException("Unexpected result type");
        }

        [RoleAuthorize(Role.Admin)]
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            await _protocolService.Delete(id);
            return Ok();
        }

        [HttpGet]
        public async Task<IActionResult> List()
        {
            var result = await _protocolService.List();
            return Ok(result);
        }

        [HttpGet]
        [Route("{id}")]
        public async Task<IActionResult> Get(int id)
        {
            var protocols = await _protocolService.List();
            var protocol = protocols.FirstOrDefault(a => a.Id == id);
            if (protocol == null)
            {
                return NotFound($"Protocol with ID {id} not found.");
            }
            return Ok(protocol);
        }

        [HttpGet("{id}/image.png")]
        public async Task<IActionResult> GetProtocolImage(int id)
        {
            var protocol = await _protocolService.GetById(id);
            if (protocol == null || protocol.Image == null || protocol.Image.Length == 0)
            {
                return NotFound("Image not found.");
            }
            return File(protocol.Image, "image/png", "image.png");
        }

        [HttpGet("statistics/changes")]
        public async Task<IActionResult> GetStatisticsChanges()
        {
            var result = await _protocolService.GetStatisticsChanges();
            return Ok(result);
        }

        [HttpGet("with-metrics")]
        public async Task<IActionResult> ListWithMetrics()
        {
            var result = await _protocolService.ListWithMetrics();
            return Ok(result);
        }
    }
}

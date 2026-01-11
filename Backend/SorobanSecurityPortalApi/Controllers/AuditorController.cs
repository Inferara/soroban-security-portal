using Microsoft.AspNetCore.Mvc;
using SorobanSecurityPortalApi.Authorization.Attributes;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Models.ViewModels;
using SorobanSecurityPortalApi.Services.ControllersServices;

namespace SorobanSecurityPortalApi.Controllers
{
    [ApiController]
    [Route("api/v1/auditors")]
    public class AuditorController : ControllerBase
    {
        private readonly IAuditorService _auditorService;

        public AuditorController(IAuditorService auditorService)
        {
            _auditorService = auditorService;
        }

        [RoleAuthorize(Role.Admin, Role.Moderator)]
        [HttpPost]
        public async Task<IActionResult> Add([FromForm] string auditorData, [FromForm] IFormFile? image = null)
        {
            var jsonOptions = new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true };
            var auditorViewModel = System.Text.Json.JsonSerializer.Deserialize<AuditorViewModel>(auditorData, jsonOptions);
            if (auditorViewModel == null)
            {
                return BadRequest("Invalid auditor data.");
            }

            if (image != null && image.Length > 0)
            {
                using var memoryStream = new MemoryStream();
                await image.CopyToAsync(memoryStream);
                auditorViewModel.ImageData = memoryStream.ToArray();
            }

            var result = await _auditorService.Add(auditorViewModel);
            return Ok(result);
        }

        [RoleAuthorize(Role.Admin, Role.Moderator)]
        [HttpPut]
        public async Task<IActionResult> Update([FromForm] string auditorData, [FromForm] IFormFile? image = null)
        {
            var jsonOptions = new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true };
            var auditorViewModel = System.Text.Json.JsonSerializer.Deserialize<AuditorViewModel>(auditorData, jsonOptions);
            if (auditorViewModel == null)
            {
                return BadRequest("Invalid auditor data.");
            }

            if (image != null && image.Length > 0)
            {
                using var memoryStream = new MemoryStream();
                await image.CopyToAsync(memoryStream);
                auditorViewModel.ImageData = memoryStream.ToArray();
            }

            var result = await _auditorService.Update(auditorViewModel);
            if (result is Result<AuditorViewModel, string>.Ok ok)
                return Ok(ok.Value);
            else if (result is Result<AuditorViewModel, string>.Err err)
                return BadRequest(err.Error);
            else
                throw new InvalidOperationException("Unexpected result type");
        }

        [RoleAuthorize(Role.Admin)]
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            await _auditorService.Delete(id);
            return Ok();
        }

        [HttpGet]
        public async Task<IActionResult> List()
        {
            var result = await _auditorService.List();
            return Ok(result);
        }

        [HttpGet]
        [Route("{id}")]
        public async Task<IActionResult> Get(int id)
        {
            var auditors = await _auditorService.List();
            var auditor = auditors.FirstOrDefault(a => a.Id == id);
            if (auditor == null)
            {
                return NotFound($"Auditor with ID {id} not found.");
            }
            return Ok(auditor);
        }

        [HttpGet("{id}/image.png")]
        public async Task<IActionResult> GetAuditorImage(int id)
        {
            var auditor = await _auditorService.GetById(id);
            if (auditor == null || auditor.Image == null || auditor.Image.Length == 0)
            {
                return NotFound("Image not found.");
            }
            return File(auditor.Image, "image/png", "image.png");
        }

        [HttpGet("statistics/changes")]
        public async Task<IActionResult> GetStatisticsChanges()
        {
            var result = await _auditorService.GetStatisticsChanges();
            return Ok(result);
        }
    }
}

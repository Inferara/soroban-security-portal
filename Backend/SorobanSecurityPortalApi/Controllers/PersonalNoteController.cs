using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SorobanSecurityPortalApi.Models.ViewModels;
using SorobanSecurityPortalApi.Services.ControllersServices;

namespace SorobanSecurityPortalApi.Controllers
{
    [ApiController]
    [Authorize]
    [Route("api/v1/personal-notes")]
    public class PersonalNoteController : ControllerBase
    {
        private readonly IPersonalNoteService _personalNoteService;

        public PersonalNoteController(IPersonalNoteService personalNoteService)
        {
            _personalNoteService = personalNoteService;
        }

        [HttpGet]
        [Authorize]
        public async Task<IActionResult> List()
        {
            var result = await _personalNoteService.List();
            return Ok(result);
        }

        [HttpGet("vulnerability/{vulnerabilityId}")]
        [Authorize]
        public async Task<IActionResult> GetByVulnerability(int vulnerabilityId)
        {
            if (vulnerabilityId <= 0)
            {
                return BadRequest("VulnerabilityId must be a positive integer.");
            }

            var note = await _personalNoteService.GetByVulnerability(vulnerabilityId);
            if (note == null)
            {
                return NoContent();
            }

            return Ok(note);
        }

        [HttpPost("vulnerability/{vulnerabilityId}")]
        [HttpPut("vulnerability/{vulnerabilityId}")]
        [Authorize]
        public async Task<IActionResult> Save(int vulnerabilityId, [FromBody] UpsertPersonalNoteRequest request)
        {
            if (vulnerabilityId <= 0)
            {
                return BadRequest("VulnerabilityId must be a positive integer.");
            }

            if (request == null || string.IsNullOrWhiteSpace(request.Content))
            {
                return BadRequest("Note content cannot be empty.");
            }

            var trimmed = request.Content.Trim();
            if (trimmed.Length > PersonalNoteService.MaxNoteLength)
            {
                return BadRequest($"Note content must not exceed {PersonalNoteService.MaxNoteLength} characters.");
            }

            try
            {
                var result = await _personalNoteService.Save(vulnerabilityId, trimmed);
                return Ok(result);
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(ex.Message);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpDelete("{id}")]
        [Authorize]
        public async Task<IActionResult> Delete(int id)
        {
            if (id <= 0)
            {
                return BadRequest("Note ID must be a positive integer.");
            }

            try
            {
                await _personalNoteService.Delete(id);
                return NoContent();
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(ex.Message);
            }
        }

        [HttpDelete("vulnerability/{vulnerabilityId}")]
        [Authorize]
        public async Task<IActionResult> DeleteByVulnerability(int vulnerabilityId)
        {
            if (vulnerabilityId <= 0)
            {
                return BadRequest("VulnerabilityId must be a positive integer.");
            }

            try
            {
                await _personalNoteService.DeleteByVulnerability(vulnerabilityId);
                return NoContent();
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(ex.Message);
            }
        }
    }
}

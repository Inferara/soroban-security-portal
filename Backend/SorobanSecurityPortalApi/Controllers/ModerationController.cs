using Microsoft.AspNetCore.Mvc;
using SorobanSecurityPortalApi.Authorization.Attributes;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Models.ViewModels;
using SorobanSecurityPortalApi.Services.ControllersServices;

namespace SorobanSecurityPortalApi.Controllers
{
    [ApiController]
    [Route("api/v1/moderation")]
    public class ModerationController : ControllerBase
    {
        private readonly IModerationService _service;
        public ModerationController(IModerationService service) => _service = service;

        [HttpGet("queue")]
        [RoleAuthorize(Role.Admin, Role.Moderator)]
        public async Task<IActionResult> Queue([FromQuery] string? status, [FromQuery] string? contentType, [FromQuery] int page = 1)
            => Ok(await _service.GetQueue(status, contentType, page));

        [HttpPost("action")]
        [RoleAuthorize(Role.Admin, Role.Moderator)]
        public async Task<IActionResult> Action([FromBody] ModerationActionRequest request)
        {
            var result = await _service.TakeAction(request);
            return result switch
            {
                Result<bool, string>.Ok => Ok(true),
                Result<bool, string>.Err e => BadRequest(e.Error),
                _ => throw new InvalidOperationException("Unexpected result")
            };
        }

        [HttpGet("stats")]
        [RoleAuthorize(Role.Admin, Role.Moderator)]
        public async Task<IActionResult> Stats() => Ok(await _service.GetStats());
    }
}

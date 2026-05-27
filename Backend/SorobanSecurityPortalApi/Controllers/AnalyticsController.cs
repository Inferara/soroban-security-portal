using Microsoft.AspNetCore.Mvc;
using SorobanSecurityPortalApi.Authorization.Attributes;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Services.ControllersServices;

namespace SorobanSecurityPortalApi.Controllers
{
    [ApiController]
    [Route("api/v1/analytics")]
    public class AnalyticsController : ControllerBase
    {
        private readonly IPageViewService _service;
        public AnalyticsController(IPageViewService service) => _service = service;

        public class RecordPageViewRequest
        {
            public EntityType EntityType { get; set; }
            public int EntityId { get; set; }
        }

        // Public: the SPA records a human view on page mount. Bots that don't run JS never reach this.
        // Unauthenticated by design; the per-visitor/day dedupe is NOT an anti-abuse control — abuse
        // protection is expected at the nginx/ingress layer. Body is a tiny fixed DTO.
        [HttpPost("view")]
        public async Task<IActionResult> RecordView([FromBody] RecordPageViewRequest req)
        {
            if (req == null || req.EntityId <= 0 || !Enum.IsDefined(typeof(EntityType), req.EntityType))
                return BadRequest("Invalid entity.");

            await _service.RecordView(req.EntityType, req.EntityId, Request.GetClientIp(), UserAgent());
            return Ok();
        }

        // Public: per-entity counter for the on-page "Views" card.
        [HttpGet("view/{entityType:int}/{entityId:int}")]
        public async Task<IActionResult> GetCounts(int entityType, int entityId)
        {
            if (entityId <= 0 || !Enum.IsDefined(typeof(EntityType), entityType))
                return BadRequest("Invalid entity.");
            return Ok(await _service.GetCounts((EntityType)entityType, entityId));
        }

        // Admin/Moderator only: aggregated dashboard.
        [RoleAuthorize(Role.Admin, Role.Moderator)]
        [HttpGet("statistics")]
        public async Task<IActionResult> Statistics() => Ok(await _service.GetStatistics());

        private string UserAgent() => Request.Headers.UserAgent.ToString();
    }
}

using Microsoft.AspNetCore.Mvc;
using SorobanSecurityPortalApi.Models.ViewModels;
using SorobanSecurityPortalApi.Services.ControllersServices;
using SorobanSecurityPortalApi.Authorization.Attributes;
using SorobanSecurityPortalApi.Common.Security;

namespace SorobanSecurityPortalApi.Controllers
{
    [ApiController]
    [Route("api/v1/activities")]
    public class ActivityController : ControllerBase
    {
        private readonly IActivityService _activityService;

        public ActivityController(IActivityService activityService)
        {
            _activityService = activityService;
        }

        [HttpGet]
        public async Task<IActionResult> GetRecentActivities([FromQuery] int? hours = 24, [FromQuery] int? limit = 10)
        {
            var result = await _activityService.GetRecentActivities(hours, limit);
            return Ok(result);
        }

        [RoleAuthorize(Role.Admin, Role.Moderator, Role.Contributor, Role.User)]
        [HttpGet("personalized")]
        public async Task<IActionResult> GetPersonalizedActivities([FromQuery] int? hours = 24, [FromQuery] int? limit = 10)
        {
            var result = await _activityService.GetPersonalizedActivities(hours, limit);
            return Ok(result);
        }
    }
}

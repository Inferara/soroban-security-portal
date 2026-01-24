using Microsoft.AspNetCore.Mvc;
using SorobanSecurityPortalApi.Models.ViewModels;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Services.ControllersServices;
using SorobanSecurityPortalApi.Authorization.Attributes;
using SorobanSecurityPortalApi.Common.Security;

namespace SorobanSecurityPortalApi.Controllers
{
    [ApiController]
    [Route("api/v1/follows")]
    public class UserFollowController : ControllerBase
    {
        private readonly IUserFollowService _userFollowService;

        public UserFollowController(IUserFollowService userFollowService)
        {
            _userFollowService = userFollowService;
        }

        [RoleAuthorize(Role.Admin, Role.Moderator, Role.Contributor, Role.User)]
        [HttpGet]
        public async Task<IActionResult> GetMyFollows()
        {
            var result = await _userFollowService.GetMyFollows();
            return Ok(result);
        }

        [RoleAuthorize(Role.Admin, Role.Moderator, Role.Contributor, Role.User)]
        [HttpGet("check/{entityType}/{entityId}")]
        public async Task<IActionResult> IsFollowing(FollowEntityType entityType, int entityId)
        {
            var result = await _userFollowService.IsFollowing(entityType, entityId);
            return Ok(result);
        }

        [RoleAuthorize(Role.Admin, Role.Moderator, Role.Contributor, Role.User)]
        [HttpPost]
        public async Task<IActionResult> Follow([FromBody] CreateFollowViewModel follow)
        {
            var result = await _userFollowService.Follow(follow);
            return Ok(result);
        }

        [RoleAuthorize(Role.Admin, Role.Moderator, Role.Contributor, Role.User)]
        [HttpDelete("{entityType}/{entityId}")]
        public async Task<IActionResult> Unfollow(FollowEntityType entityType, int entityId)
        {
            var result = await _userFollowService.Unfollow(entityType, entityId);
            if (result) return Ok();
            return BadRequest("Failed to unfollow.");
        }
    }
}

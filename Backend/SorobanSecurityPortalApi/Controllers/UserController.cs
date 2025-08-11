using SorobanSecurityPortalApi.Authorization.Attributes;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Common.Extensions;
using SorobanSecurityPortalApi.Models.ViewModels;
using SorobanSecurityPortalApi.Services.ControllersServices;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace SorobanSecurityPortalApi.Controllers
{
    [ApiController]
    [Authorize]
    [Route("api/v1/user")]
    public class UserController : ControllerBase
    {
        private readonly IUserService _userService;
        private readonly Config _config;
        private readonly UserContextAccessor _userContextAccessor;

        public UserController(IUserService userService, Config config, UserContextAccessor userContextAccessor)           
        {
            _userService = userService;
            _config = config;
            _userContextAccessor = userContextAccessor;
        }

        [Authorize]
        [HttpGet("{loginId}")]
        public async Task<IActionResult> GetUser(int loginId)
        {
            var currentUser = this.GetLogin();
            if (currentUser == null)
                return Unauthorized();
            if (loginId == 0)
            {
                loginId = await _userContextAccessor.GetLoginIdAsync() ?? 0;
            }

            var login = await _userService.GetLoginById(loginId);
            return Ok(login);
        }

        [AllowAnonymous]
        [HttpGet("{loginId}/avatar.png")]
        public async Task<IActionResult> GetUserAvatar(int loginId)
        {
            var login = await _userService.GetLoginById(loginId);
            if (login.Image == null || login.Image.Length == 0)
            {
                return BadRequest("Avatar is not found.");
            }
            return File(login.Image, "image/png", $"avatar.png");
        }

        [RoleAuthorize(Role.Admin)]
        [HttpGet]
        public async Task<IActionResult> GetUsers()
        {
            var logins = await _userService.List();
            return Ok(logins);
        }

        [RoleAuthorize(Role.Admin)]
        [HttpPost("{loginId}/enable")]
        public async Task<IActionResult> EnableUser(int loginId)
        {
            await _userService.EnabledChange(loginId, true);
            return Ok(true);
        }

        [RoleAuthorize(Role.Admin)]
        [HttpPost("{loginId}/disable")]
        public async Task<IActionResult> DisableUser(int loginId)
        {
            await _userService.EnabledChange(loginId, false);
            return Ok(true);
        }

        [RoleAuthorize(Role.Admin)]
        [HttpPost]
        public async Task<IActionResult> AddUser([FromBody]LoginSummaryViewModel loginSummaryViewModel)
        {
            var currentUser = this.GetLogin();
            if (currentUser == null) return Unauthorized();

            loginSummaryViewModel.CreatedBy = currentUser;

            var model = await _userService.Add(loginSummaryViewModel);
            return Ok(model != null);
        }

        [RoleAuthorize(Role.Admin)]
        [HttpPut("{loginId}")]
        public async Task<IActionResult> UpdateUser(int loginId, [FromBody] LoginViewModel editLoginViewModel)
        {
            var currentUser = this.GetLogin();
            if (currentUser == null) return Unauthorized();

            var saved = await _userService.Update(loginId, editLoginViewModel);

            return Ok(saved);
        }

        [RoleAuthorize(Role.Admin)]
        [HttpDelete("{loginId}")]
        public async Task<IActionResult> DeleteUser(int loginId)
        {
            var currentUser = this.GetLogin();
            if (currentUser == null) return Unauthorized();

            var removed = await _userService.Delete(loginId);

            return Ok(removed);
        }

        [Authorize]
        [HttpPost("changePassword")]
        public async Task<IActionResult> ChangeUserPassword([FromBody] ChangePasswordViewModel changePasswordViewModel)
        {
            var currentUser = this.GetLogin();
            if (currentUser == null) return Unauthorized();

            var result = await _userService.ChangePassword(currentUser!, changePasswordViewModel);
            return Ok(result);
        }
    }
}

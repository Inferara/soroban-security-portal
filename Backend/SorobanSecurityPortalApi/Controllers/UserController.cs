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
        private readonly INotificationService _notificationService;
        private readonly Config _config;
        private readonly UserContextAccessor _userContextAccessor;

        public UserController(
            IUserService userService,
            INotificationService notificationService,
            Config config,
            UserContextAccessor userContextAccessor)
        {
            _userService = userService;
            _notificationService = notificationService;
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
                loginId = await _userContextAccessor.GetLoginIdAsync();
            }

            var login = await _userService.GetLoginById(loginId);
            return Ok(login);
        }

        [AllowAnonymous]
        [HttpGet("{loginId}/avatar.png")]
        public async Task<IActionResult> GetUserAvatar(int loginId)
        {
            var login = await _userService.GetLoginById(loginId);
            if (login?.Image == null || login.Image.Length == 0)
            {
                return NotFound("Avatar not found.");
            }
            return File(login.Image, "image/png", "avatar.png");
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
            //TODO: remove loginId, already in LoginViewModel
            var saved = await _userService.Update(loginId, editLoginViewModel);

            return Ok(saved);
        }

        [Authorize]
        [HttpPut("self/{loginId}")]
        public async Task<IActionResult> SelfUpdateUser(int loginId, [FromBody] LoginSelfUpdateViewModel userUpdateSelfViewModel)
        {
            var currentUser = this.GetLogin();
            if (currentUser == null) return Unauthorized();

            // Get the authenticated user's actual ID from the token/context
            var currentUserId = await _userContextAccessor.GetLoginIdAsync();

            // Verify the user is only updating their own profile
            if (currentUserId != loginId)
            {
                return Forbid();
            }

            var user = await _userService.GetLoginById(loginId);
            if (user == null)
            {
                return NotFound();
            }

            if (!user.IsEnabled)
            {
                return BadRequest("User is disabled.");
            }

            var saved = await _userService.SelfUpdate(loginId, userUpdateSelfViewModel);

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

        [Authorize]
        [HttpGet("search")]
        public async Task<IActionResult> SearchUsers([FromQuery] string query, [FromQuery] int limit = 5)
        {
            if (string.IsNullOrWhiteSpace(query) || query.Length < 2)
            {
                return BadRequest("Query must be at least 2 characters long.");
            }

            if (limit > 10)
            {
                limit = 10; // Max limit
            }

            var users = await _userService.SearchUsers(query, limit);
            return Ok(users);
        }

        [Authorize]
        [HttpGet("notifications")]
        public async Task<IActionResult> GetNotifications([FromQuery] bool onlyUnread = false)
        {
            var currentUser = this.GetLogin();
            if (currentUser == null) return Unauthorized();

            var currentUserId = await _userContextAccessor.GetLoginIdAsync();
            var notifications = await _notificationService.GetNotificationsForUser(currentUserId, onlyUnread);
            return Ok(notifications);
        }

        [Authorize]
        [HttpGet("notifications/unread-count")]
        public async Task<IActionResult> GetUnreadNotificationCount()
        {
            var currentUser = this.GetLogin();
            if (currentUser == null) return Unauthorized();

            var currentUserId = await _userContextAccessor.GetLoginIdAsync();
            var count = await _notificationService.GetUnreadCount(currentUserId);
            return Ok(new { count });
        }

        [Authorize]
        [HttpPost("notifications/{notificationId}/read")]
        public async Task<IActionResult> MarkNotificationAsRead(int notificationId)
        {
            var currentUser = this.GetLogin();
            if (currentUser == null) return Unauthorized();

            var currentUserId = await _userContextAccessor.GetLoginIdAsync();
            await _notificationService.MarkAsRead(notificationId, currentUserId);
            return Ok();
        }

        [Authorize]
        [HttpPost("notifications/mark-all-read")]
        public async Task<IActionResult> MarkAllNotificationsAsRead()
        {
            var currentUser = this.GetLogin();
            if (currentUser == null) return Unauthorized();

            var currentUserId = await _userContextAccessor.GetLoginIdAsync();
            await _notificationService.MarkAllAsRead(currentUserId);
            return Ok();
        }

        [Authorize]
        [HttpDelete("notifications/{notificationId}")]
        public async Task<IActionResult> DeleteNotification(int notificationId)
        {
            var currentUser = this.GetLogin();
            if (currentUser == null) return Unauthorized();

            var currentUserId = await _userContextAccessor.GetLoginIdAsync();
            await _notificationService.DeleteNotification(notificationId, currentUserId);
            return Ok();
        }
    }
}

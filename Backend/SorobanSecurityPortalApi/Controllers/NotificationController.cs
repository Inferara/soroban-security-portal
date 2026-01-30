using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Models.ViewModels;
using SorobanSecurityPortalApi.Services.ControllersServices;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace SorobanSecurityPortalApi.Controllers
{
    [Route("api/v1/notifications")]
    [ApiController]
    [Authorize]
    public class NotificationController : ControllerBase
    {
        private readonly INotificationService _notificationService;
        private readonly IUserContextAccessor _userContextAccessor;

        public NotificationController(INotificationService notificationService, IUserContextAccessor userContextAccessor)
        {
            _notificationService = notificationService;
            _userContextAccessor = userContextAccessor;
        }

        [HttpGet]
        public async Task<ActionResult<List<NotificationViewModel>>> GetNotifications()
        {
            var userId = _userContextAccessor.LoginId;
            var notifications = await _notificationService.GetNotifications(userId);
            return Ok(notifications);
        }

        [HttpPost("{id}/read")]
        public async Task<ActionResult> MarkAsRead(int id)
        {
            await _notificationService.MarkAsRead(id);
            return Ok();
        }

        [HttpPost("read-all")]
        public async Task<ActionResult> MarkAllAsRead()
        {
            var userId = _userContextAccessor.LoginId;
            await _notificationService.MarkAllAsRead(userId);
            return Ok();
        }
    }
}

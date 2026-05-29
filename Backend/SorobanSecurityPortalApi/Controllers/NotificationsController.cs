using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Services.ControllersServices;

namespace SorobanSecurityPortalApi.Controllers
{
    [ApiController]
    [Route("api/v1/notifications")]
    [Authorize]
    public class NotificationsController : ControllerBase
    {
        private readonly INotificationService _service;
        public NotificationsController(INotificationService service) => _service = service;

        [HttpGet]
        public async Task<IActionResult> Get([FromQuery] NotificationType? type, [FromQuery] int page = 1)
            => Ok(await _service.GetNotifications(type, page));

        [HttpGet("unread-count")]
        public async Task<IActionResult> UnreadCount() => Ok(await _service.GetUnreadCount());

        [HttpPost("{id}/read")]
        public async Task<IActionResult> Read(int id)
        {
            if (id <= 0) return BadRequest("Notification ID must be a positive integer.");
            await _service.MarkRead(id);
            return NoContent();
        }

        [HttpPost("read-all")]
        public async Task<IActionResult> ReadAll()
        {
            await _service.MarkAllRead();
            return NoContent();
        }
    }
}

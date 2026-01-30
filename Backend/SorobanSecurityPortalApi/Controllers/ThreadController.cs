using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Models.ViewModels;
using SorobanSecurityPortalApi.Services.ControllersServices;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace SorobanSecurityPortalApi.Controllers
{
    [Route("api/v1/threads")]
    [ApiController]
    [Authorize]
    public class ThreadController : ControllerBase
    {
        private readonly IThreadService _threadService;
        private readonly IUserContextAccessor _userContextAccessor;

        public ThreadController(IThreadService threadService, IUserContextAccessor userContextAccessor)
        {
            _threadService = threadService;
            _userContextAccessor = userContextAccessor;
        }

        [HttpGet("vulnerability/{vulnerabilityId}")]
        public async Task<ActionResult<ThreadViewModel?>> GetThread(int vulnerabilityId)
        {
            var userId = _userContextAccessor.LoginId;
            await _threadService.EnsureThreadExists(vulnerabilityId, userId);
            var thread = await _threadService.GetThreadByVulnerabilityId(vulnerabilityId, userId);
            return Ok(thread);
        }

        [HttpPost("reply")]
        public async Task<ActionResult<int>> AddReply([FromBody] AddReplyRequest request)
        {
            var userId = _userContextAccessor.LoginId;
            var replyId = await _threadService.AddReply(request.ThreadId, userId, request.Content);
            return Ok(replyId);
        }

        [HttpPost("watch")]
        public async Task<ActionResult> ToggleWatch([FromBody] ToggleWatchRequest request)
        {
            var userId = _userContextAccessor.LoginId;
            await _threadService.ToggleWatch(request.ThreadId, userId, request.IsWatching);
            return Ok();
        }

        [HttpGet("watched")]
        public async Task<ActionResult<List<ThreadViewModel>>> GetWatchedThreads()
        {
            var userId = _userContextAccessor.LoginId;
            var threads = await _threadService.GetWatchedThreads(userId);
            return Ok(threads);
        }
    }

    public class AddReplyRequest
    {
        public int ThreadId { get; set; }
        public string Content { get; set; } = "";
    }

    public class ToggleWatchRequest
    {
        public int ThreadId { get; set; }
        public bool IsWatching { get; set; }
    }
}

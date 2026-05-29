using Microsoft.AspNetCore.Mvc;
using SorobanSecurityPortalApi.Authorization.Attributes;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Models.ViewModels;
using SorobanSecurityPortalApi.Services.ControllersServices;

namespace SorobanSecurityPortalApi.Controllers
{
    [ApiController]
    [Route("api/v1/agent-runs")]
    public class AgentRunsController : ControllerBase
    {
        private readonly IAgentRunService _service;

        public AgentRunsController(IAgentRunService service)
        {
            _service = service;
        }

        [RoleAuthorize(Role.Admin, Role.Moderator)]
        [HttpPost]
        public async Task<IActionResult> Enqueue([FromBody] EnqueueAgentRunViewModel request)
        {
            var result = await _service.Enqueue(request);
            return result switch
            {
                Result<AgentRunViewModel, string>.Ok ok => Ok(ok.Value),
                Result<AgentRunViewModel, string>.Err err => BadRequest(err.Error),
                _ => throw new InvalidOperationException("Unexpected result type")
            };
        }

        [RoleAuthorize(Role.Admin, Role.Moderator)]
        [HttpGet]
        public async Task<IActionResult> List([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
        {
            return Ok(await _service.List(page, pageSize));
        }

        [RoleAuthorize(Role.Admin, Role.Moderator)]
        [HttpGet("{id}")]
        public async Task<IActionResult> Get(int id)
        {
            var run = await _service.Get(id);
            return run == null ? NotFound() : Ok(run);
        }

        [RoleAuthorize(Role.Admin, Role.Moderator)]
        [HttpPost("{id}/approve")]
        public async Task<IActionResult> Approve(int id)
        {
            var result = await _service.Approve(id);
            return result switch
            {
                Result<bool, string>.Ok => Ok(),
                Result<bool, string>.Err err => BadRequest(err.Error),
                _ => throw new InvalidOperationException("Unexpected result type")
            };
        }

        [RoleAuthorize(Role.Admin, Role.Moderator)]
        [HttpPost("{id}/reject")]
        public async Task<IActionResult> Reject(int id)
        {
            var result = await _service.Reject(id);
            return result switch
            {
                Result<bool, string>.Ok => Ok(),
                Result<bool, string>.Err err => BadRequest(err.Error),
                _ => throw new InvalidOperationException("Unexpected result type")
            };
        }

        [RoleAuthorize(Role.Admin, Role.Moderator)]
        [HttpPost("{id}/rerun")]
        public async Task<IActionResult> Rerun(int id)
        {
            var result = await _service.Rerun(id);
            return result switch
            {
                Result<AgentRunViewModel, string>.Ok ok => Ok(ok.Value),
                Result<AgentRunViewModel, string>.Err err => BadRequest(err.Error),
                _ => throw new InvalidOperationException("Unexpected result type")
            };
        }

        // --- Internal worker endpoints (cluster-internal trust; blocked from Ingress in a later deploy plan) ---

        [HttpPost("internal/claim-next")]
        public async Task<IActionResult> ClaimNext()
        {
            var run = await _service.ClaimNext();
            return run == null ? NoContent() : Ok(run);
        }

        [HttpPost("internal/{id}/submit")]
        public async Task<IActionResult> SubmitResult(int id, [FromBody] SubmitAgentRunResultViewModel result)
        {
            var r = await _service.SubmitResult(id, result);
            return r switch
            {
                Result<bool, string>.Ok => Ok(),
                Result<bool, string>.Err err => BadRequest(err.Error),
                _ => throw new InvalidOperationException("Unexpected result type")
            };
        }
    }
}

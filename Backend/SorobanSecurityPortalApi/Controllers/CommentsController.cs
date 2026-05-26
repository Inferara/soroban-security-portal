using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;
using SorobanSecurityPortalApi.Services.ControllersServices;

namespace SorobanSecurityPortalApi.Controllers
{
    [ApiController]
    [Route("api/v1/comments")]
    public class CommentsController : ControllerBase
    {
        private readonly ICommentService _commentService;

        public CommentsController(ICommentService commentService)
        {
            _commentService = commentService;
        }

        [HttpGet]
        public async Task<IActionResult> Get([FromQuery] EntityType entityType, [FromQuery] int entityId, [FromQuery] int page = 1)
        {
            if (entityId <= 0) return BadRequest("EntityId must be a positive integer.");
            var result = await _commentService.GetComments(entityType, entityId, page);
            return Ok(result);
        }

        [HttpGet("count")]
        public async Task<IActionResult> Count([FromQuery] EntityType entityType, [FromQuery] int entityId)
        {
            if (entityId <= 0) return BadRequest("EntityId must be a positive integer.");
            var count = await _commentService.GetCount(entityType, entityId);
            return Ok(count);
        }

        [HttpPost]
        [Authorize]
        public async Task<IActionResult> Create([FromBody] CreateCommentRequest request)
        {
            if (request == null) return BadRequest("Request body cannot be null.");
            if (request.EntityId <= 0) return BadRequest("EntityId must be a positive integer.");
            if (string.IsNullOrWhiteSpace(request.Content)) return BadRequest("Content must not be empty.");
            if (request.Content.Length > 10000) return BadRequest("Content must not exceed 10000 characters.");

            try
            {
                var result = await _commentService.AddComment(request);
                return Ok(result);
            }
            catch (KeyNotFoundException ex) { return NotFound(ex.Message); }
            catch (InvalidOperationException ex) { return BadRequest(ex.Message); }
        }

        [HttpDelete("{id}")]
        [Authorize]
        public async Task<IActionResult> Delete(int id)
        {
            if (id <= 0) return BadRequest("Comment ID must be a positive integer.");
            try
            {
                await _commentService.DeleteComment(id);
                return NoContent();
            }
            catch (System.UnauthorizedAccessException) { return Forbid(); }
            catch (KeyNotFoundException) { return NotFound($"Comment with id {id} not found."); }
        }
    }
}

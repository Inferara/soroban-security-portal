using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SorobanSecurityPortalApi.Services.ProcessingServices;
using SorobanSecurityPortalApi.Models.ViewModels;
using System.Security.Claims;

namespace SorobanSecurityPortalApi.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/v1/[controller]")]
    public class CommentController : ControllerBase
    {
        private readonly ICommentService _commentService;

        public CommentController(ICommentService commentService)
        {
            _commentService = commentService;
        }

        [HttpGet("{entityType}/{entityId}")]
        [AllowAnonymous] // Anyone can view comments
        public async Task<ActionResult<List<CommentViewModel>>> GetComments(string entityType, int entityId)
        {
            var comments = await _commentService.GetThreadedComments(entityType, entityId);
            return Ok(comments);
        }

        [HttpPost]
        public async Task<ActionResult<CommentViewModel>> CreateComment([FromBody] CreateCommentRequest request)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdClaim, out int authorId))
                return Unauthorized();

            var result = await _commentService.PostComment(
                authorId, 
                request.EntityType, 
                request.EntityId, 
                request.Content, 
                request.ParentCommentId
            );

            return CreatedAtAction(nameof(GetComments), new { entityType = request.EntityType, entityId = request.EntityId }, result);
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteComment(int id)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdClaim, out int userId))
                return Unauthorized();

            var success = await _commentService.DeleteComment(id, userId);
            if (!success) return BadRequest("Failed to delete comment.");

            return NoContent();
        }
    }

    public class CreateCommentRequest
    {
        public string EntityType { get; set; } = string.Empty;
        public int EntityId { get; set; }
        public string Content { get; set; } = string.Empty;
        public int? ParentCommentId { get; set; }
    }
}
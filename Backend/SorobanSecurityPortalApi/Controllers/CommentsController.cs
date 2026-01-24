using Microsoft.AspNetCore.Mvc;
using SorobanSecurityPortalApi.Models.ViewModels;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Services.ControllersServices;
using SorobanSecurityPortalApi.Authorization.Attributes;
using SorobanSecurityPortalApi.Common.Security;

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

        [HttpGet("{entityType}/{entityId}")]
        public async Task<IActionResult> GetComments(CommentEntityType entityType, int entityId)
        {
            var result = await _commentService.GetByEntity(entityType, entityId);
            return Ok(result);
        }

        [RoleAuthorize(Role.Admin, Role.Moderator, Role.Contributor, Role.User)]
        [HttpPost]
        public async Task<IActionResult> Add([FromBody] CreateCommentViewModel comment)
        {
            var result = await _commentService.Add(comment);
            return Ok(result);
        }

        [RoleAuthorize(Role.Admin, Role.Moderator, Role.Contributor, Role.User)]
        [HttpPut]
        public async Task<IActionResult> Update([FromBody] UpdateCommentViewModel comment)
        {
            try
            {
                var result = await _commentService.Update(comment);
                if (result) return Ok();
                return BadRequest("Failed to update comment or unauthorized.");
            }
            catch (UnauthorizedAccessException)
            {
                return Unauthorized();
            }
        }

        [RoleAuthorize(Role.Admin, Role.Moderator, Role.Contributor, Role.User)]
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var result = await _commentService.Delete(id);
            if (result) return Ok();
            return BadRequest("Failed to delete comment or unauthorized.");
        }
    }
}

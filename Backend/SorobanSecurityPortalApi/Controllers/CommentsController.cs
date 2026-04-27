using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;
using SorobanSecurityPortalApi.Services.ControllersServices;
using SorobanSecurityPortalApi.Common;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace SorobanSecurityPortalApi.Controllers
{
    [ApiController]
    [Route("api/v1/comments")]
    public class CommentsController : ControllerBase
    {
        private readonly ICommentService _commentService;
        private readonly IUserContextAccessor _userContextAccessor;

        public CommentsController(ICommentService commentService, IUserContextAccessor userContextAccessor)
        {
            _commentService = commentService;
            _userContextAccessor = userContextAccessor;
        }

        [HttpGet]
        public async Task<IActionResult> GetComments([FromQuery] CommentEntityType entityType, [FromQuery] int entityId, [FromQuery] int page = 1)
        {
            if (page < 1) page = 1;
            var pageSize = 20;
            
            int? currentUserId = null;
            if (User.Identity?.IsAuthenticated == true)
            {
                currentUserId = await _userContextAccessor.GetLoginIdAsync();
            }
            
            var comments = await _commentService.GetComments(entityType, entityId, page, pageSize, currentUserId);
            var total = await _commentService.GetCommentsTotal(entityType, entityId);

            return Ok(new
            {
                items = comments,
                total = total,
                page = page,
                pageSize = pageSize
            });
        }

        [HttpPost]
        [Authorize]
        public async Task<IActionResult> CreateComment([FromBody] CommentCreateViewModel model)
        {
            if (string.IsNullOrWhiteSpace(model.Content))
                return BadRequest("Content is required");

            try
            {
                var loginId = await _userContextAccessor.GetLoginIdAsync();
                var comment = await _commentService.AddComment(model, loginId);
                return Created($"/api/v1/comments/{comment.Id}", comment);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpPut("{id}")]
        [Authorize]
        public async Task<IActionResult> UpdateComment(int id, [FromBody] CommentUpdateViewModel model)
        {
            if (string.IsNullOrWhiteSpace(model.Content))
                return BadRequest("Content is required");

            try
            {
                var loginId = await _userContextAccessor.GetLoginIdAsync();
                var comment = await _commentService.UpdateComment(id, model, loginId);
                return Ok(comment);
            }
            catch (KeyNotFoundException)
            {
                return NotFound();
            }
            catch (UnauthorizedAccessException)
            {
                return Forbid();
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpDelete("{id}")]
        [Authorize]
        public async Task<IActionResult> DeleteComment(int id)
        {
            try
            {
                var loginId = await _userContextAccessor.GetLoginIdAsync();
                var isAdmin = _userContextAccessor.HasRole(nameof(RoleEnum.Admin));
                await _commentService.DeleteComment(id, loginId, isAdmin);
                return NoContent();
            }
            catch (UnauthorizedAccessException)
            {
                return Forbid();
            }
        }

        [HttpPost("{id}/vote")]
        [Authorize]
        public async Task<IActionResult> Vote(int id, [FromQuery] VoteType vote)
        {
            var loginId = await _userContextAccessor.GetLoginIdAsync();
            await _commentService.Vote(id, vote, loginId);
            return Ok();
        }
    }
}

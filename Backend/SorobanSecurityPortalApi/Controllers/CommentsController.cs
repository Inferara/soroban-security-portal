using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;
using SorobanSecurityPortalApi.Services.ControllersServices;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace SorobanSecurityPortalApi.Controllers
{
    [ApiController]
    [Route("api/v1/comments")]
    [Authorize]
    public class CommentsController : ControllerBase
    {
        private readonly ICommentService _commentService;

        public CommentsController(ICommentService commentService)
        {
            _commentService = commentService;
        }

        [HttpGet]
        public async Task<IActionResult> GetComments([FromQuery] CommentEntityType entityType, [FromQuery] int entityId, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
        {
            var comments = await _commentService.GetComments(entityType, entityId, page, pageSize);
            var count = await _commentService.GetCommentsCount(entityType, entityId);
            return Ok(new { comments, totalCount = count });
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetComment(int id)
        {
            var comment = await _commentService.GetComment(id);
            if (comment == null)
            {
                return NotFound($"Comment with id {id} not found.");
            }
            return Ok(comment);
        }

        [HttpPost]
        public async Task<IActionResult> CreateComment([FromBody] CommentCreateViewModel model)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                var comment = await _commentService.CreateComment(model);
                return CreatedAtAction(nameof(GetComment), new { id = comment.Id }, comment);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
            catch (Exception ex)
            {
                return StatusCode(500, "An error occurred while creating the comment.");
            }
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateComment(int id, [FromBody] CommentUpdateViewModel model)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                await _commentService.UpdateComment(id, model);
                return NoContent();
            }
            catch (KeyNotFoundException)
            {
                return NotFound($"Comment with id {id} not found.");
            }
            catch (UnauthorizedAccessException)
            {
                return Forbid();
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
            catch (Exception ex)
            {
                return StatusCode(500, "An error occurred while updating the comment.");
            }
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteComment(int id)
        {
            try
            {
                await _commentService.DeleteComment(id);
                return NoContent();
            }
            catch (KeyNotFoundException)
            {
                return NotFound($"Comment with id {id} not found.");
            }
            catch (UnauthorizedAccessException)
            {
                return Forbid();
            }
            catch (Exception ex)
            {
                return StatusCode(500, "An error occurred while deleting the comment.");
            }
        }

        [HttpPost("{id}/vote")]
        public async Task<IActionResult> Vote(int id, [FromBody] VoteRequest request)
        {
            try
            {
                await _commentService.Vote(id, request);
                return NoContent();
            }
            catch (ArgumentNullException ex)
            {
                return BadRequest(ex.Message);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ex.Message);
            }
            catch (KeyNotFoundException)
            {
                return NotFound($"Comment with id {id} not found.");
            }
            catch (Exception ex)
            {
                return StatusCode(500, "An error occurred while processing the vote.");
            }
        }
    }
}
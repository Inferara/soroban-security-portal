using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Models.ViewModels;
using SorobanSecurityPortalApi.Services.ControllersServices;

namespace SorobanSecurityPortalApi.Controllers
{
    [ApiController]
    [Route("api/v1/forum")]
    public class ForumController : ControllerBase
    {
        private readonly IForumService _forumService;
        private readonly IUserContextAccessor _userContextAccessor;

        public ForumController(IForumService forumService, IUserContextAccessor userContextAccessor)
        {
            _forumService = forumService;
            _userContextAccessor = userContextAccessor;
        }

        /// <summary>
        /// GET /api/v1/forum/categories
        /// List all forum categories with thread counts
        /// </summary>
        [HttpGet("categories")]
        public async Task<IActionResult> GetCategories()
        {
            try
            {
                var result = await _forumService.GetCategories();
                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        /// <summary>
        /// GET /api/v1/forum/categories/{slug}/threads
        /// List paginated threads for a category
        /// </summary>
        [HttpGet("categories/{slug}/threads")]
        public async Task<IActionResult> GetThreadsByCategory(
            string slug,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20)
        {
            if (string.IsNullOrWhiteSpace(slug))
                return BadRequest("Category slug must not be empty.");
            if (page < 1)
                return BadRequest("Page must be at least 1.");
            if (pageSize < 1 || pageSize > 100)
                return BadRequest("Page size must be between 1 and 100.");

            try
            {
                var result = await _forumService.GetThreadsByCategory(slug, page, pageSize);
                Response.Headers.Add("X-Total-Count", result.TotalCount.ToString());
                return Ok(result);
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        /// <summary>
        /// GET /api/v1/forum/threads/{slug}
        /// Get a thread with paginated posts
        /// </summary>
        [HttpGet("threads/{slug}")]
        public async Task<IActionResult> GetThreadBySlug(
            string slug,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20)
        {
            if (string.IsNullOrWhiteSpace(slug))
                return BadRequest("Thread slug must not be empty.");
            if (page < 1)
                return BadRequest("Page must be at least 1.");
            if (pageSize < 1 || pageSize > 100)
                return BadRequest("Page size must be between 1 and 100.");

            try
            {
                var result = await _forumService.GetThreadBySlug(slug, page, pageSize);

                // Record view with rate limiting
                var visitorId = await _userContextAccessor.GetLoginIdOrNullAsync();
                var visitorIdentifier = visitorId?.ToString() ?? Request.HttpContext.Connection.RemoteIpAddress?.ToString();
                await _forumService.RecordThreadView(result.Id, visitorIdentifier);

                Response.Headers.Add("X-Total-Count", result.TotalPosts.ToString());
                return Ok(result);
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        /// <summary>
        /// POST /api/v1/forum/threads
        /// Create a new thread (which creates the first post)
        /// </summary>
        [HttpPost("threads")]
        [Authorize]
        public async Task<IActionResult> CreateThread([FromBody] CreateThreadRequest request)
        {
            if (request == null)
                return BadRequest("Request body cannot be null.");
            if (request.CategoryId <= 0)
                return BadRequest("CategoryId must be a positive integer.");
            if (string.IsNullOrWhiteSpace(request.Title))
                return BadRequest("Title must not be empty.");
            if (request.Title.Length > 200)
                return BadRequest("Title must not exceed 200 characters.");
            if (string.IsNullOrWhiteSpace(request.Content))
                return BadRequest("Content must not be empty.");
            if (request.Content.Length > 10000)
                return BadRequest("Content must not exceed 10000 characters.");

            try
            {
                var result = await _forumService.CreateThread(request);
                return CreatedAtAction(nameof(GetThreadBySlug), new { slug = result.Slug }, result);
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (UnauthorizedAccessException ex)
            {
                return Unauthorized(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        /// <summary>
        /// POST /api/v1/forum/threads/{id}/posts
        /// Reply to a thread (create a new post)
        /// </summary>
        [HttpPost("threads/{id}/posts")]
        [Authorize]
        public async Task<IActionResult> CreatePost(int id, [FromBody] CreatePostRequest request)
        {
            if (id <= 0)
                return BadRequest("Thread ID must be a positive integer.");
            if (request == null)
                return BadRequest("Request body cannot be null.");
            if (string.IsNullOrWhiteSpace(request.Content))
                return BadRequest("Content must not be empty.");
            if (request.Content.Length > 10000)
                return BadRequest("Content must not exceed 10000 characters.");

            try
            {
                var result = await _forumService.CreatePost(id, request);
                return CreatedAtAction(nameof(GetThreadBySlug), result);
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (UnauthorizedAccessException ex)
            {
                return Unauthorized(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        /// <summary>
        /// PUT /api/v1/forum/posts/{id}
        /// Edit a forum post
        /// </summary>
        [HttpPut("posts/{id}")]
        [Authorize]
        public async Task<IActionResult> UpdatePost(int id, [FromBody] UpdatePostRequest request)
        {
            if (id <= 0)
                return BadRequest("Post ID must be a positive integer.");
            if (request == null)
                return BadRequest("Request body cannot be null.");
            if (string.IsNullOrWhiteSpace(request.Content))
                return BadRequest("Content must not be empty.");
            if (request.Content.Length > 10000)
                return BadRequest("Content must not exceed 10000 characters.");

            try
            {
                var result = await _forumService.UpdatePost(id, request);
                return Ok(result);
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (UnauthorizedAccessException ex)
            {
                return Forbid();
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        /// <summary>
        /// POST /api/v1/forum/posts/{id}/vote
        /// Vote on a forum post (upvote, downvote, or remove vote)
        /// </summary>
        [HttpPost("posts/{id}/vote")]
        [Authorize]
        public async Task<IActionResult> VoteOnPost(int id, [FromBody] ForumVoteRequest request)
        {
            if (id <= 0)
                return BadRequest("Post ID must be a positive integer.");
            if (request == null)
                return BadRequest("Request body cannot be null.");
            if (string.IsNullOrWhiteSpace(request.VoteType))
                return BadRequest("VoteType must not be empty.");

            try
            {
                var result = await _forumService.VoteOnPost(id, request.VoteType);
                return Ok(result);
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (UnauthorizedAccessException ex)
            {
                return Unauthorized(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }
    }
}

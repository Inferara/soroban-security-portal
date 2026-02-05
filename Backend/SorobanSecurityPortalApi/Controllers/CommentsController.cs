using Microsoft.AspNetCore.Mvc;
using SorobanSecurityPortalApi.Authorization.Attributes;
using SorobanSecurityPortalApi.Common;
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
        private readonly IUserContextAccessor _userContextAccessor;

        public CommentsController(ICommentService commentService, IUserContextAccessor userContextAccessor)
        {
            _commentService = commentService;
            _userContextAccessor = userContextAccessor;
        }

        [Authorize]
        [HttpPost]
        public async Task<IActionResult> Add([FromBody] CreateCommentRequest request)
        {
            var userId = _userContextAccessor.UserId;
            var result = await _commentService.Add(userId, request);
            
            if (result is Result<CommentViewModel, string>.Ok ok)
                return Ok(ok.Value);
            else if (result is Result<CommentViewModel, string>.Err err)
                return BadRequest(err.Error);
            else
                return StatusCode(500);
        }

        [Authorize]
        [HttpPut("{commentId}")]
        public async Task<IActionResult> Update(int commentId, [FromBody] UpdateCommentRequest request)
        {
            var userId = _userContextAccessor.UserId;
            var result = await _commentService.Update(userId, commentId, request);

            if (result is Result<CommentViewModel, string>.Ok ok)
                return Ok(ok.Value);
            else if (result is Result<CommentViewModel, string>.Err err)
                return BadRequest(err.Error);
            else
                return StatusCode(500);
        }

        [Authorize]
        [HttpDelete("{commentId}")]
        public async Task<IActionResult> Delete(int commentId)
        {
            var userId = _userContextAccessor.UserId;
            // Check if admin
            // We can check role via context or pass flag to service
            var isAdmin = _userContextAccessor.Role == RoleEnum.Admin || _userContextAccessor.Role == RoleEnum.Moderator; // Moderators can delete too typically

            var result = await _commentService.Delete(userId, commentId, isAdmin);

            if (result is Result<bool, string>.Ok)
                return Ok();
            else if (result is Result<bool, string>.Err err)
                return BadRequest(err.Error);
            else
                return StatusCode(500);
        }

        [HttpGet("{referenceType}/{referenceId}")]
        public async Task<IActionResult> List(ReferenceType referenceType, int referenceId)
        {
            // Anonymous users can list comments? Assuming yes.
            int? userId = null;
            try { userId = _userContextAccessor.UserId; } catch { /* ignore if not auth */ }

            var result = await _commentService.List(referenceId, referenceType, userId);
            return Ok(result);
        }

        [Authorize]
        [HttpGet("{commentId}/history")]
        public async Task<IActionResult> GetHistory(int commentId)
        {
            // Only moderators/admins
            var isAdmin = _userContextAccessor.Role == RoleEnum.Admin || _userContextAccessor.Role == RoleEnum.Moderator;
            
            var userId = _userContextAccessor.UserId;
            var result = await _commentService.GetHistory(userId, commentId, isAdmin);

            if (result is Result<List<CommentHistoryItem>, string>.Ok ok)
                return Ok(ok.Value);
            else if (result is Result<List<CommentHistoryItem>, string>.Err err)
                return BadRequest(err.Error);
            else
                return StatusCode(500);
        }
    }
}

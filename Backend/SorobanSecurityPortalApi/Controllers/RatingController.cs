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
    [Route("api/v1/ratings")]
    public class RatingController : ControllerBase
    {
        private readonly IRatingService _ratingService;

        public RatingController(IRatingService ratingService)
        {
            _ratingService = ratingService;
        }

        [HttpGet("summary")]
        public async Task<IActionResult> GetSummary([FromQuery] EntityType entityType, [FromQuery] int entityId)
        {
            // Ensure entityId is positive
            if (entityId <= 0)
            {
                return BadRequest("EntityId must be a positive integer.");
            }

            var result = await _ratingService.GetSummary(entityType, entityId);
            return Ok(result);
        }

        [HttpGet("summary/weighted")]
        public async Task<IActionResult> GetSummaryWeighted([FromQuery] EntityType entityType, [FromQuery] int entityId)
        {
            if (entityId <= 0)
            {
                return BadRequest("EntityId must be a positive integer.");
            }

            var result = await _ratingService.GetSummaryWeighted(entityType, entityId);
            return Ok(result);
        }

        [HttpGet]
        public async Task<IActionResult> GetRatings([FromQuery] EntityType entityType, [FromQuery] int entityId, [FromQuery] int page = 1)
        {
            // Ensure entityId is positive
            if (entityId <= 0)
            {
                return BadRequest("EntityId must be a positive integer.");
            }

            var result = await _ratingService.GetRatings(entityType, entityId, page);
            return Ok(result);
        }

        [HttpGet("with-author")]
        public async Task<IActionResult> GetRatingsWithAuthor(
            [FromQuery] EntityType entityType,
            [FromQuery] int entityId,
            [FromQuery] int page = 1,
            [FromQuery] bool reviewsOnly = false)
        {
            if (entityId <= 0)
            {
                return BadRequest("EntityId must be a positive integer.");
            }

            var result = await _ratingService.GetRatingsWithAuthor(entityType, entityId, page, 10, reviewsOnly);
            return Ok(result);
        }

        [HttpGet("mine")]
        [Authorize]
        public async Task<IActionResult> GetMyRating([FromQuery] EntityType entityType, [FromQuery] int entityId)
        {
            if (entityId <= 0)
            {
                return BadRequest("EntityId must be a positive integer.");
            }

            var result = await _ratingService.GetMyRating(entityType, entityId);
            return Ok(result);
        }

        [HttpPost]
        [Authorize]
        public async Task<IActionResult> CreateOrUpdate([FromBody] CreateRatingRequest request)
        {

            if (request == null)
            {
                return BadRequest("Request body cannot be null.");
            }

            if (request.Score < 1 || request.Score > 5)
            {
                return BadRequest("Score must be between 1 and 5.");
            }

            var result = await _ratingService.AddOrUpdateRating(request);
            return Ok(result);
        }

        [HttpDelete("{id}")]
        [Authorize]
        public async Task<IActionResult> Delete(int id)
        {
            if (id <= 0) return BadRequest("Rating ID must be a positive integer.");

            try
            {
                await _ratingService.DeleteRating(id);
                return NoContent();
            }
            catch (System.UnauthorizedAccessException)
            {
                return Forbid();
            }
            catch (KeyNotFoundException)
            {
                return NotFound($"Rating with id {id} not found.");
            }
        }
    }
}
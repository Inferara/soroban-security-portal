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
            var result = await _ratingService.GetSummary(entityType, entityId);
            return Ok(result);
        }

        [HttpGet]
        public async Task<IActionResult> GetRatings([FromQuery] EntityType entityType, [FromQuery] int entityId, [FromQuery] int page = 1)
        {
            var result = await _ratingService.GetRatings(entityType, entityId, page);
            return Ok(result);
        }

        [HttpPost]
        [Authorize]
        public async Task<IActionResult> CreateOrUpdate([FromBody] CreateRatingRequest request)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);
            
            var result = await _ratingService.AddOrUpdateRating(request);
            return Ok(result);
        }

        [HttpDelete("{id}")]
        [Authorize]
        public async Task<IActionResult> Delete(int id)
        {
            try
            {
                await _ratingService.DeleteRating(id);
                return NoContent();
            }
            catch (System.UnauthorizedAccessException)
            {
                return Forbid();
            }
        }
    }
}

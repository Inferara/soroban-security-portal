using SorobanSecurityPortalApi.Services.ControllersServices;
using Microsoft.AspNetCore.Mvc;
using SorobanSecurityPortalApi.Models.ViewModels;
using SorobanSecurityPortalApi.Authorization.Attributes;
using SorobanSecurityPortalApi.Common;

namespace SorobanSecurityPortalApi.Controllers
{
    [ApiController]
    [Route("api/v1/auditor-ratings")]
    public class AuditorRatingController : ControllerBase
    {
        private readonly IAuditorRatingService _ratingService;

        public AuditorRatingController(IAuditorRatingService ratingService)
        {
            _ratingService = ratingService;
        }

        [RoleAuthorize] // Any logged in user can rate? Or maybe specific roles.
        [HttpPost]
        public async Task<IActionResult> Add([FromBody] AuditorRatingViewModel ratingViewModel)
        {
            if (ratingViewModel == null)
            {
                return BadRequest("Invalid rating data.");
            }

            var result = await _ratingService.Add(ratingViewModel);
            return Ok(result);
        }

        [HttpGet("auditor/{auditorId}")]
        public async Task<IActionResult> ListByAuditor(int auditorId)
        {
            var result = await _ratingService.ListByAuditorId(auditorId);
            return Ok(result);
        }

        [HttpGet("auditor/{auditorId}/average")]
        public async Task<IActionResult> GetAverage(int auditorId)
        {
            var result = await _ratingService.GetAverageRating(auditorId);
            return Ok(result);
        }
    }
}

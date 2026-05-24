using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Models.ViewModels;
using SorobanSecurityPortalApi.Services.ControllersServices;

namespace SorobanSecurityPortalApi.Controllers
{
    [ApiController]
    [Route("api/v1/profiles")]
    public class UserProfileController : ControllerBase
    {
        private readonly IUserProfileService _profileService;
        private readonly UserContextAccessor _userContext;
        private readonly ILogger<UserProfileController> _logger;

        public UserProfileController(
            IUserProfileService profileService,
            UserContextAccessor userContext,
            ILogger<UserProfileController> logger)
        {
            _profileService = profileService;
            _userContext = userContext;
            _logger = logger;
        }

        /// <summary>
        /// Get public user profile by login ID (public endpoint — no PII)
        /// </summary>
        [HttpGet("{loginId}")]
        [AllowAnonymous]
        public async Task<ActionResult<PublicUserProfileViewModel>> GetProfile(int loginId)
        {
            try
            {
                var profile = await _profileService.GetPublicProfileByLoginIdAsync(loginId);
                if (profile == null)
                {
                    return NotFound(new { message = "Profile not found" });
                }

                return Ok(profile);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving profile for loginId: {LoginId}", loginId);
                return StatusCode(500, new { message = "An error occurred while retrieving the profile" });
            }
        }

        /// <summary>
        /// Get current authenticated user's profile
        /// </summary>
        [HttpGet("self")]
        [Authorize]
        public async Task<ActionResult<UserProfileViewModel>> GetSelfProfile()
        {
            try
            {
                var loginId = await _userContext.GetLoginIdAsync();

                var profile = await _profileService.GetProfileByLoginIdAsync(loginId);
                if (profile == null)
                {
                    return NotFound(new { message = "Profile not found" });
                }

                return Ok(profile);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving profile for current user");
                return StatusCode(500, new { message = "An error occurred while retrieving your profile" });
            }
        }

        /// <summary>
        /// Create or update current user's profile
        /// </summary>
        [HttpPut("self")]
        [Authorize]
        public async Task<ActionResult<UserProfileViewModel>> UpdateSelfProfile(
            [FromBody] UpdateUserProfileViewModel profileDto)
        {
            try
            {
                var loginId = await _userContext.GetLoginIdAsync();

                var existingProfile = await _profileService.GetProfileByLoginIdAsync(loginId);
                Result<UserProfileViewModel, string> result;

                if (existingProfile == null)
                {
                    result = await _profileService.CreateProfileAsync(loginId, profileDto);
                }
                else
                {
                    result = await _profileService.UpdateProfileAsync(loginId, profileDto);
                }

                if (result is Result<UserProfileViewModel, string>.Ok ok)
                    return Ok(ok.Value);
                else if (result is Result<UserProfileViewModel, string>.Err err)
                    return BadRequest(new { message = err.Error });

                return StatusCode(500, new { message = "An error occurred while updating your profile" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating profile for current user");
                return StatusCode(500, new { message = "An error occurred while updating your profile" });
            }
        }

        /// <summary>
        /// Delete current user's profile
        /// </summary>
        [HttpDelete("self")]
        [Authorize]
        public async Task<IActionResult> DeleteSelfProfile()
        {
            try
            {
                var loginId = await _userContext.GetLoginIdAsync();

                await _profileService.DeleteProfileAsync(loginId);
                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting profile for current user");
                return StatusCode(500, new { message = "An error occurred while deleting your profile" });
            }
        }
    }
}
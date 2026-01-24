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

        public UserProfileController(IUserProfileService profileService, UserContextAccessor userContext)
        {
            _profileService = profileService;
            _userContext = userContext;
        }

        /// <summary>
        /// Get user profile by user ID (public endpoint)
        /// </summary>
        [HttpGet("{userId}")]
        [AllowAnonymous]
        public async Task<ActionResult<UserProfileViewModel>> GetProfile(int userId)
        {
            try
            {
                var profile = await _profileService.GetProfileByUserIdAsync(userId);
                if (profile == null)
                {
                    return NotFound(new { message = "Profile not found" });
                }

                return Ok(profile);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "An error occurred", error = ex.Message });
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
                return StatusCode(500, new { message = "An error occurred", error = ex.Message });
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
                UserProfileViewModel updatedProfile;

                if (existingProfile == null)
                {
                    updatedProfile = await _profileService.CreateProfileAsync(loginId, profileDto);
                }
                else
                {
                    updatedProfile = await _profileService.UpdateProfileAsync(loginId, profileDto);
                }

                return Ok(updatedProfile);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "An error occurred", error = ex.Message });
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
                return StatusCode(500, new { message = "An error occurred", error = ex.Message });
            }
        }
    }
}
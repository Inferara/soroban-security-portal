using AutoMapper;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;

namespace SorobanSecurityPortalApi.Services.ControllersServices
{
    public class UserProfileService : IUserProfileService
    {
        private readonly IUserProfileProcessor _processor;
        private readonly ILoginProcessor _loginProcessor;
        private readonly IMapper _mapper;

        public UserProfileService(IUserProfileProcessor processor, ILoginProcessor loginProcessor, IMapper mapper)
        {
            _processor = processor;
            _loginProcessor = loginProcessor;
            _mapper = mapper;
        }

        public async Task<PublicUserProfileViewModel?> GetPublicProfileByLoginIdAsync(int loginId)
        {
            var profile = await _processor.GetByLoginIdAsync(loginId);
            if (profile != null) return _mapper.Map<PublicUserProfileViewModel>(profile);

            // Most users never fill in a profile, but they still author comments/reviews
            // and should have a viewable page. Return an empty profile for any existing,
            // enabled user; only a non-existent/disabled login gives null (404).
            var login = await _loginProcessor.GetById(loginId);
            if (login is { IsEnabled: true })
            {
                return new PublicUserProfileViewModel { LoginId = loginId };
            }
            return null;
        }

        public async Task<UserProfileViewModel?> GetProfileByLoginIdAsync(int loginId)
        {
            var profile = await _processor.GetByLoginIdAsync(loginId);
            return profile != null ? _mapper.Map<UserProfileViewModel>(profile) : null;
        }

        public async Task<Result<UserProfileViewModel, string>> CreateProfileAsync(int loginId, UpdateUserProfileViewModel profileDto)
        {
            var validationError = ValidateProfileDto(profileDto);
            if (validationError != null)
                return new Result<UserProfileViewModel, string>.Err(validationError);

            if (await _processor.ExistsAsync(loginId))
            {
                throw new InvalidOperationException("Profile already exists for this user");
            }

            var profile = new UserProfileModel
            {
                LoginId = loginId,
                Bio = profileDto.Bio,
                Location = profileDto.Location,
                Website = profileDto.Website,
                ExpertiseTags = profileDto.ExpertiseTags ?? new List<string>(),
                ReputationScore = 0
            };

            await _processor.CreateAsync(profile);

            // Re-fetch with Login navigation so Email/FullName are populated in the response
            var createdProfile = await _processor.GetByLoginIdAsync(loginId);
            return new Result<UserProfileViewModel, string>.Ok(_mapper.Map<UserProfileViewModel>(createdProfile));
        }

        public async Task<Result<UserProfileViewModel, string>> UpdateProfileAsync(int loginId, UpdateUserProfileViewModel profileDto)
        {
            var validationError = ValidateProfileDto(profileDto);
            if (validationError != null)
                return new Result<UserProfileViewModel, string>.Err(validationError);

            var existingProfile = await _processor.GetByLoginIdAsync(loginId);
            if (existingProfile == null)
            {
                throw new InvalidOperationException("Profile not found");
            }

            // PUT semantics: assign every field unconditionally so callers can clear fields
            existingProfile.Bio = profileDto.Bio;
            existingProfile.Location = profileDto.Location;
            existingProfile.Website = profileDto.Website;
            existingProfile.ExpertiseTags = profileDto.ExpertiseTags ?? new List<string>();

            var updatedProfile = await _processor.UpdateAsync(existingProfile);
            return new Result<UserProfileViewModel, string>.Ok(_mapper.Map<UserProfileViewModel>(updatedProfile));
        }

        public async Task DeleteProfileAsync(int loginId)
        {
            var profile = await _processor.GetByLoginIdAsync(loginId);
            if (profile != null)
            {
                await _processor.DeleteAsync(profile.Id);
            }
        }

        private static string? ValidateProfileDto(UpdateUserProfileViewModel dto)
        {
            if (dto.Bio != null && dto.Bio.Length > 500)
                return "Bio must not exceed 500 characters.";

            if (dto.Location != null && dto.Location.Length > 100)
                return "Location must not exceed 100 characters.";

            if (dto.Website != null && dto.Website.Length > 200)
                return "Website must not exceed 200 characters.";

            if (!string.IsNullOrEmpty(dto.Website) &&
                (!Uri.TryCreate(dto.Website, UriKind.Absolute, out var uri)
                 || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps)))
            {
                return "Website must be an absolute http or https URL.";
            }

            return null;
        }
    }

    public interface IUserProfileService
    {
        Task<PublicUserProfileViewModel?> GetPublicProfileByLoginIdAsync(int loginId);
        Task<UserProfileViewModel?> GetProfileByLoginIdAsync(int loginId);
        Task<Result<UserProfileViewModel, string>> CreateProfileAsync(int loginId, UpdateUserProfileViewModel profileDto);
        Task<Result<UserProfileViewModel, string>> UpdateProfileAsync(int loginId, UpdateUserProfileViewModel profileDto);
        Task DeleteProfileAsync(int loginId);
    }
}
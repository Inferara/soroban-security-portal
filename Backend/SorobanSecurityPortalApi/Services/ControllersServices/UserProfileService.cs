using AutoMapper;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;

namespace SorobanSecurityPortalApi.Services.ControllersServices
{
    public class UserProfileService : IUserProfileService
    {
        private readonly IUserProfileProcessor _processor;
        private readonly IMapper _mapper;

        public UserProfileService(IUserProfileProcessor processor, IMapper mapper)
        {
            _processor = processor;
            _mapper = mapper;
        }

        public async Task<UserProfileViewModel?> GetProfileByUserIdAsync(int userId)
        {
            var profile = await _processor.GetByIdAsync(userId);
            return profile != null ? _mapper.Map<UserProfileViewModel>(profile) : null;
        }

        public async Task<UserProfileViewModel?> GetProfileByLoginIdAsync(int loginId)
        {
            var profile = await _processor.GetByLoginIdAsync(loginId);
            return profile != null ? _mapper.Map<UserProfileViewModel>(profile) : null;
        }

        public async Task<UserProfileViewModel> CreateProfileAsync(int loginId, UpdateUserProfileViewModel profileDto)
        {
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
                TwitterHandle = profileDto.TwitterHandle,
                GithubHandle = profileDto.GithubHandle,
                ExpertiseTags = profileDto.ExpertiseTags ?? new List<string>(),
                ReputationScore = 0
            };

            var createdProfile = await _processor.CreateAsync(profile);
            return _mapper.Map<UserProfileViewModel>(createdProfile);
        }

        public async Task<UserProfileViewModel> UpdateProfileAsync(int loginId, UpdateUserProfileViewModel profileDto)
        {
            var existingProfile = await _processor.GetByLoginIdAsync(loginId);
            if (existingProfile == null)
            {
                throw new InvalidOperationException("Profile not found");
            }

            if (profileDto.Bio != null) existingProfile.Bio = profileDto.Bio;
            if (profileDto.Location != null) existingProfile.Location = profileDto.Location;
            if (profileDto.Website != null) existingProfile.Website = profileDto.Website;
            if (profileDto.TwitterHandle != null) existingProfile.TwitterHandle = profileDto.TwitterHandle;
            if (profileDto.GithubHandle != null) existingProfile.GithubHandle = profileDto.GithubHandle;
            if (profileDto.ExpertiseTags != null) existingProfile.ExpertiseTags = profileDto.ExpertiseTags;

            var updatedProfile = await _processor.UpdateAsync(existingProfile);
            return _mapper.Map<UserProfileViewModel>(updatedProfile);
        }

        public async Task DeleteProfileAsync(int loginId)
        {
            var profile = await _processor.GetByLoginIdAsync(loginId);
            if (profile != null)
            {
                await _processor.DeleteAsync(profile.Id);
            }
        }
    }

    public interface IUserProfileService
    {
        Task<UserProfileViewModel?> GetProfileByUserIdAsync(int userId);
        Task<UserProfileViewModel?> GetProfileByLoginIdAsync(int loginId);
        Task<UserProfileViewModel> CreateProfileAsync(int loginId, UpdateUserProfileViewModel profileDto);
        Task<UserProfileViewModel> UpdateProfileAsync(int loginId, UpdateUserProfileViewModel profileDto);
        Task DeleteProfileAsync(int loginId);
    }
}
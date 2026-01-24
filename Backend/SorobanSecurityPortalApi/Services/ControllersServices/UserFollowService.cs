using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;

namespace SorobanSecurityPortalApi.Services.ControllersServices
{
    public class UserFollowService : IUserFollowService
    {
        private readonly IUserFollowProcessor _userFollowProcessor;
        private readonly UserContextAccessor _userContextAccessor;

        public UserFollowService(
            IUserFollowProcessor userFollowProcessor,
            UserContextAccessor userContextAccessor)
        {
            _userFollowProcessor = userFollowProcessor;
            _userContextAccessor = userContextAccessor;
        }

        public async Task<bool> Follow(CreateFollowViewModel followViewModel)
        {
            var userId = await _userContextAccessor.GetLoginIdAsync();
            var followId = await _userFollowProcessor.Follow(userId, followViewModel.EntityType, followViewModel.EntityId);
            return followId > 0;
        }

        public async Task<bool> Unfollow(FollowEntityType entityType, int entityId)
        {
            var userId = await _userContextAccessor.GetLoginIdAsync();
            return await _userFollowProcessor.Unfollow(userId, entityType, entityId);
        }

        public async Task<bool> IsFollowing(FollowEntityType entityType, int entityId)
        {
            var userId = await _userContextAccessor.GetLoginIdAsync();
            return await _userFollowProcessor.IsFollowing(userId, entityType, entityId);
        }

        public async Task<List<UserFollowViewModel>> GetMyFollows()
        {
            var userId = await _userContextAccessor.GetLoginIdAsync();
            return await _userFollowProcessor.GetUserFollows(userId);
        }
    }

    public interface IUserFollowService
    {
        Task<bool> Follow(CreateFollowViewModel followViewModel);
        Task<bool> Unfollow(FollowEntityType entityType, int entityId);
        Task<bool> IsFollowing(FollowEntityType entityType, int entityId);
        Task<List<UserFollowViewModel>> GetMyFollows();
    }
}

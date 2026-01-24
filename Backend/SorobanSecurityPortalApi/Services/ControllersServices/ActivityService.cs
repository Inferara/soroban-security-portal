using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.ViewModels;

namespace SorobanSecurityPortalApi.Services.ControllersServices
{
    public class ActivityService : IActivityService
    {
        private readonly IActivityProcessor _activityProcessor;
        private readonly UserContextAccessor _userContextAccessor;

        public ActivityService(
            IActivityProcessor activityProcessor,
            UserContextAccessor userContextAccessor)
        {
            _activityProcessor = activityProcessor;
            _userContextAccessor = userContextAccessor;
        }

        public async Task<List<ActivityViewModel>> GetRecentActivities(int? hours = null, int? limit = null)
        {
            var effectiveHours = hours ?? 24;
            var effectiveLimit = limit ?? 10;
            
            return await _activityProcessor.GetRecentActivities(effectiveHours, effectiveLimit);
        }

        public async Task<List<ActivityViewModel>> GetPersonalizedActivities(int? hours = null, int? limit = null)
        {
            var userId = await _userContextAccessor.GetLoginIdAsync();
            var effectiveHours = hours ?? 24;
            var effectiveLimit = limit ?? 10;
            
            return await _activityProcessor.GetPersonalizedActivities(userId, effectiveHours, effectiveLimit);
        }
    }

    public interface IActivityService
    {
        Task<List<ActivityViewModel>> GetRecentActivities(int? hours = null, int? limit = null);
        Task<List<ActivityViewModel>> GetPersonalizedActivities(int? hours = null, int? limit = null);
    }
}

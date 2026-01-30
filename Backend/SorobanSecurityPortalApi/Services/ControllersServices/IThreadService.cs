using SorobanSecurityPortalApi.Models.ViewModels;

namespace SorobanSecurityPortalApi.Services.ControllersServices
{
    public interface IThreadService
    {
        Task<ThreadViewModel?> GetThreadByVulnerabilityId(int vulnerabilityId, int userId);
        Task<int> AddReply(int threadId, int userId, string content);
        Task ToggleWatch(int threadId, int userId, bool isWatching);
        Task<List<ThreadViewModel>> GetWatchedThreads(int userId);
        Task EnsureThreadExists(int vulnerabilityId, int userId);
    }
}

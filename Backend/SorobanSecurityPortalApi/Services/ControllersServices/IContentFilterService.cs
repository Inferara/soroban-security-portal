using SorobanSecurityPortalApi.Models.ViewModels;

namespace SorobanSecurityPortalApi.Services.ControllersServices
{
    public interface IContentFilterService
    {
        // Comments and reviews: the default link limit applies.
        Task<ContentFilterResult> FilterContentAsync(string content, int userId);
        // Caller chooses the link limit; null skips the link-count check (every other check still runs).
        Task<ContentFilterResult> FilterContentAsync(string content, int userId, int? maxLinks);
        Task<bool> CheckRateLimitAsync(int userId);
        HashSet<string> GetDefaultProfanityWords();
        HashSet<string> GetAllProfanityWords();
    }
}

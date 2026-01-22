using SorobanSecurityPortalApi.Models.ViewModels;

namespace SorobanSecurityPortalApi.Services.ControllersServices
{
    public interface IContentFilterService
    {
        Task<ContentFilterResult> FilterContentAsync(string content, int userId);
        Task<bool> CheckRateLimitAsync(int userId);
    }
}

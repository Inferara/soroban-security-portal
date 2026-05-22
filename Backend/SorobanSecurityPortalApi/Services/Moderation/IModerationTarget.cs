using SorobanSecurityPortalApi.Models.DbModels;

namespace SorobanSecurityPortalApi.Services.Moderation
{
    public interface IModerationTarget
    {
        ModeratedContentType ContentType { get; }
        Task<ModerationTargetInfo?> Get(int contentId);
        Task Hide(int contentId);
        /// <summary>
        /// Clears all moderation suppression (hidden + soft-deleted) so the content is publicly visible again. Used by the "approve" action.
        /// </summary>
        Task Restore(int contentId);
        Task SoftDelete(int contentId);
    }
}

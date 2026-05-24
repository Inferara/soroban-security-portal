using SorobanSecurityPortalApi.Models.DbModels;

namespace SorobanSecurityPortalApi.Services.Moderation
{
    public interface IModerationTargetRegistry
    {
        IModerationTarget Get(ModeratedContentType type);
        bool TryGet(ModeratedContentType type, out IModerationTarget target);
    }
}

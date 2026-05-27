using SorobanSecurityPortalApi.Models.DbModels;

namespace SorobanSecurityPortalApi.Services.Moderation
{
    public static class CommentCacheKeys
    {
        public static string Count(EntityType entityType, int entityId)
            => $"comments_count_{entityType}_{entityId}";
    }
}

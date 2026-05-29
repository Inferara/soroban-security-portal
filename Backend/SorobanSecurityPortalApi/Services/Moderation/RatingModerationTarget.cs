using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;
using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Services.ControllersServices;

namespace SorobanSecurityPortalApi.Services.Moderation
{
    public class RatingModerationTarget : IModerationTarget
    {
        private readonly IDbContextFactory<Db> _dbFactory;
        private readonly IDistributedCache _cache;

        public RatingModerationTarget(IDbContextFactory<Db> dbFactory, IDistributedCache cache)
        {
            _dbFactory = dbFactory;
            _cache = cache;
        }

        public ModeratedContentType ContentType => ModeratedContentType.Rating;

        public async Task<ModerationTargetInfo?> Get(int contentId)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var r = await db.Rating.AsNoTracking().FirstOrDefaultAsync(x => x.Id == contentId);
            if (r == null) return null;

            // Give the moderator context: which entity it's on, the score, and the review text.
            var on = $"{EntityLabel(r.EntityType)} #{r.EntityId}";
            var preview = string.IsNullOrWhiteSpace(r.Review)
                ? $"★{r.Score} on {on}"
                : $"★{r.Score} on {on}: {r.Review}";

            return new ModerationTargetInfo
            {
                Preview = preview,
                FullContent = $"Score: {r.Score}/5 on {on}\n\n{r.Review}",
                AuthorUserId = r.UserId,
                IsHidden = r.IsHidden,
                IsDeleted = r.IsDeleted,
                // A rating lives on a protocol or auditor page — link there.
                ContextType = r.EntityType == EntityType.Protocol ? "protocol" : "auditor",
                ContextId = r.EntityId
            };
        }

        public Task Hide(int contentId) => SetFlags(contentId, true, null);
        public Task Restore(int contentId) => SetFlags(contentId, false, false);
        public Task SoftDelete(int contentId) => SetFlags(contentId, null, true);

        private async Task SetFlags(int contentId, bool? isHidden, bool? isDeleted)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var r = await db.Rating.FirstOrDefaultAsync(x => x.Id == contentId);
            if (r == null) return;
            if (isHidden.HasValue) r.IsHidden = isHidden.Value;
            if (isDeleted.HasValue) r.IsDeleted = isDeleted.Value;
            await db.SaveChangesAsync();

            // Visibility changed → the cached summary (average/total/distribution) is now stale.
            await _cache.RemoveAsync(RatingService.SummaryCacheKey(r.EntityType, r.EntityId));
        }

        private static string EntityLabel(EntityType t) => t == EntityType.Protocol ? "protocol" : "auditor";
    }
}

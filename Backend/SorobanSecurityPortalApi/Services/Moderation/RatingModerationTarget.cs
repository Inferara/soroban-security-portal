using Microsoft.EntityFrameworkCore;
using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Models.DbModels;

namespace SorobanSecurityPortalApi.Services.Moderation
{
    public class RatingModerationTarget : IModerationTarget
    {
        private readonly IDbContextFactory<Db> _dbFactory;

        public RatingModerationTarget(IDbContextFactory<Db> dbFactory) => _dbFactory = dbFactory;

        public ModeratedContentType ContentType => ModeratedContentType.Rating;

        public async Task<ModerationTargetInfo?> Get(int contentId)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var r = await db.Rating.AsNoTracking().FirstOrDefaultAsync(x => x.Id == contentId);
            if (r == null) return null;

            // Give the moderator context: which entity it's on, the score, and the review text.
            var on = $"{ModerationParsingEntity(r.EntityType)} #{r.EntityId}";
            var preview = string.IsNullOrWhiteSpace(r.Review)
                ? $"★{r.Score} on {on}"
                : $"★{r.Score} on {on}: {r.Review}";

            return new ModerationTargetInfo
            {
                Preview = preview,
                FullContent = $"Score: {r.Score}/5 on {on}\n\n{r.Review}",
                AuthorUserId = r.UserId,
                IsHidden = r.IsHidden,
                IsDeleted = r.IsDeleted
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
        }

        private static string ModerationParsingEntity(EntityType t)
            => t == EntityType.Protocol ? "protocol" : "auditor";
    }
}

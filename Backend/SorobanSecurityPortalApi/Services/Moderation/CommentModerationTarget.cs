using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;
using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Models.DbModels;

namespace SorobanSecurityPortalApi.Services.Moderation
{
    public class CommentModerationTarget : IModerationTarget
    {
        private readonly IDbContextFactory<Db> _dbFactory;
        private readonly IDistributedCache _cache;

        public CommentModerationTarget(IDbContextFactory<Db> dbFactory, IDistributedCache cache)
        {
            _dbFactory = dbFactory;
            _cache = cache;
        }

        public ModeratedContentType ContentType => ModeratedContentType.Comment;

        public async Task<ModerationTargetInfo?> Get(int contentId)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var c = await db.Comment.AsNoTracking().FirstOrDefaultAsync(x => x.Id == contentId);
            if (c == null) return null;

            return new ModerationTargetInfo
            {
                Preview = c.Content.Length > 200 ? c.Content[..200] : c.Content,
                FullContent = c.Content,
                AuthorUserId = c.AuthorId,
                IsHidden = c.IsHidden,
                IsDeleted = c.IsDeleted
            };
        }

        public Task Hide(int contentId) => SetFlags(contentId, true, null);
        public Task Restore(int contentId) => SetFlags(contentId, false, false);
        public Task SoftDelete(int contentId) => SetFlags(contentId, null, true);

        private async Task SetFlags(int contentId, bool? isHidden, bool? isDeleted)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var c = await db.Comment.FirstOrDefaultAsync(x => x.Id == contentId);
            if (c == null) return;
            if (isHidden.HasValue) c.IsHidden = isHidden.Value;
            if (isDeleted.HasValue) c.IsDeleted = isDeleted.Value;
            await db.SaveChangesAsync();

            // Visibility changed → the cached comment count for this entity is now stale.
            await _cache.RemoveAsync(CommentCacheKeys.Count(c.EntityType, c.EntityId));
        }
    }
}

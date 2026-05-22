using Microsoft.EntityFrameworkCore;
using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Models.DbModels;

namespace SorobanSecurityPortalApi.Services.Moderation
{
    public class ReportModerationTarget : IModerationTarget
    {
        private readonly IDbContextFactory<Db> _dbFactory;

        public ReportModerationTarget(IDbContextFactory<Db> dbFactory) => _dbFactory = dbFactory;

        public ModeratedContentType ContentType => ModeratedContentType.Report;

        public async Task<ModerationTargetInfo?> Get(int contentId)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var r = await db.Report.AsNoTracking().FirstOrDefaultAsync(x => x.Id == contentId);
            if (r == null) return null;
            return new ModerationTargetInfo
            {
                Preview = r.Name,
                FullContent = r.Name,
                AuthorUserId = r.CreatedBy,
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
            var r = await db.Report.FirstOrDefaultAsync(x => x.Id == contentId);
            if (r == null) return;
            if (isHidden.HasValue) r.IsHidden = isHidden.Value;
            if (isDeleted.HasValue) r.IsDeleted = isDeleted.Value;
            await db.SaveChangesAsync();
        }
    }
}

using Microsoft.EntityFrameworkCore;
using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Models.DbModels;

namespace SorobanSecurityPortalApi.Data.Processors
{
    public interface IContentFlagProcessor
    {
        Task<bool> Exists(ModeratedContentType type, int contentId, int userId);
        Task Add(ContentFlagModel flag);
        Task<List<ContentFlagModel>> GetAll();
    }

    public class ContentFlagProcessor : IContentFlagProcessor
    {
        private readonly IDbContextFactory<Db> _dbFactory;

        public ContentFlagProcessor(IDbContextFactory<Db> dbFactory) => _dbFactory = dbFactory;

        public async Task<bool> Exists(ModeratedContentType type, int contentId, int userId)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            return await db.ContentFlag.AsNoTracking().AnyAsync(f => f.ContentType == type && f.ContentId == contentId && f.FlaggedByUserId == userId);
        }

        public async Task Add(ContentFlagModel flag)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            db.ContentFlag.Add(flag);
            await db.SaveChangesAsync();
        }

        public async Task<List<ContentFlagModel>> GetAll()
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            return await db.ContentFlag.AsNoTracking().ToListAsync();
        }
    }
}

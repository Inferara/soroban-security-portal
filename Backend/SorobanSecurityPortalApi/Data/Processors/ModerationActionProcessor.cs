using Microsoft.EntityFrameworkCore;
using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Models.DbModels;

namespace SorobanSecurityPortalApi.Data.Processors
{
    public interface IModerationActionProcessor
    {
        Task Add(ModerationActionModel action);
        Task<List<ModerationActionModel>> GetAll();
        Task<int> CountSince(DateTime sinceUtc);
    }

    public class ModerationActionProcessor : IModerationActionProcessor
    {
        private readonly IDbContextFactory<Db> _dbFactory;

        public ModerationActionProcessor(IDbContextFactory<Db> dbFactory) => _dbFactory = dbFactory;

        public async Task Add(ModerationActionModel action)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            db.ModerationAction.Add(action);
            await db.SaveChangesAsync();
        }

        public async Task<List<ModerationActionModel>> GetAll()
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            return await db.ModerationAction.AsNoTracking().ToListAsync();
        }

        public async Task<int> CountSince(DateTime sinceUtc)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            return await db.ModerationAction.AsNoTracking().CountAsync(a => a.CreatedAt >= sinceUtc);
        }
    }
}

using Microsoft.EntityFrameworkCore;
using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Models.DbModels;

namespace SorobanSecurityPortalApi.Data.Processors
{
    public class ModerationLogProcessor : IModerationLogProcessor
    {
        private readonly IDbContextFactory<Db> _dbFactory;

        public ModerationLogProcessor(IDbContextFactory<Db> dbFactory)
        {
            _dbFactory = dbFactory;
        }

        public async Task Add(ModerationLogModel moderationLog)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            db.ModerationLog.Add(moderationLog);
            await db.SaveChangesAsync();
        }

        public async Task<List<ModerationLogModel>> GetByUserId(int userId, int limit = 100)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            return await db.ModerationLog
                .AsNoTracking()
                .Where(m => m.UserId == userId)
                .OrderByDescending(m => m.CreatedAt)
                .Take(limit)
                .ToListAsync();
        }

        public async Task<ModerationLogModel?> GetLastByUserId(int userId)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            return await db.ModerationLog
                .AsNoTracking()
                .Where(m => m.UserId == userId)
                .OrderByDescending(m => m.CreatedAt)
                .FirstOrDefaultAsync();
        }

        public async Task<bool> HasDuplicateContent(int userId, string content, TimeSpan timeWindow)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var threshold = DateTime.UtcNow.Subtract(timeWindow);
            return await db.ModerationLog
                .AsNoTracking()
                .Where(m => m.UserId == userId && m.OriginalContent == content && m.CreatedAt >= threshold)
                .AnyAsync();
        }
    }

    public interface IModerationLogProcessor
    {
        Task Add(ModerationLogModel moderationLog);
        Task<List<ModerationLogModel>> GetByUserId(int userId, int limit = 100);
        Task<ModerationLogModel?> GetLastByUserId(int userId);
        Task<bool> HasDuplicateContent(int userId, string content, TimeSpan timeWindow);
    }
}

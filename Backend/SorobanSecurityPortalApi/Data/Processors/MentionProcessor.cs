using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Models.DbModels;
using Microsoft.EntityFrameworkCore;

namespace SorobanSecurityPortalApi.Data.Processors
{
    public class MentionProcessor : IMentionProcessor
    {
        private readonly IDbContextFactory<Db> _dbFactory;

        public MentionProcessor(IDbContextFactory<Db> dbFactory)
        {
            _dbFactory = dbFactory;
        }

        public async Task<List<MentionModel>> GetMentionsForEntity(string entityType, int entityId)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            return await db.Mention.AsNoTracking()
                .Include(m => m.MentionedUser)
                .Include(m => m.MentionedBy)
                .Where(m => m.EntityType == entityType && m.EntityId == entityId)
                .OrderBy(m => m.CreatedAt)
                .ToListAsync();
        }

        public async Task<List<MentionModel>> GetMentionsByUser(int userId)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            return await db.Mention.AsNoTracking()
                .Include(m => m.MentionedUser)
                .Include(m => m.MentionedBy)
                .Where(m => m.MentionedUserId == userId)
                .OrderByDescending(m => m.CreatedAt)
                .ToListAsync();
        }

        public async Task CreateMentions(List<MentionModel> mentions)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            await db.Mention.AddRangeAsync(mentions);
            await db.SaveChangesAsync();
        }

        public async Task DeleteMentionsForEntity(string entityType, int entityId)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var mentions = await db.Mention
                .Where(m => m.EntityType == entityType && m.EntityId == entityId)
                .ToListAsync();

            if (mentions.Any())
            {
                db.Mention.RemoveRange(mentions);
                await db.SaveChangesAsync();
            }
        }
    }

    public interface IMentionProcessor
    {
        Task<List<MentionModel>> GetMentionsForEntity(string entityType, int entityId);
        Task<List<MentionModel>> GetMentionsByUser(int userId);
        Task CreateMentions(List<MentionModel> mentions);
        Task DeleteMentionsForEntity(string entityType, int entityId);
    }
}
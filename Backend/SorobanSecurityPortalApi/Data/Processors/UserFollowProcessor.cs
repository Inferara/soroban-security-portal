using Microsoft.EntityFrameworkCore;
using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;

namespace SorobanSecurityPortalApi.Data.Processors
{
    public class UserFollowProcessor : IUserFollowProcessor
    {
        private readonly IDbContextFactory<Db> _dbFactory;

        public UserFollowProcessor(IDbContextFactory<Db> dbFactory)
        {
            _dbFactory = dbFactory;
        }

        public async Task<int> Follow(int loginId, FollowEntityType entityType, int entityId)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            
            // Check if already following
            var existing = await db.UserFollow
                .FirstOrDefaultAsync(f => f.LoginId == loginId && 
                                         f.EntityType == entityType && 
                                         f.EntityId == entityId);
            
            if (existing != null) return existing.Id;
            
            var follow = new UserFollowModel
            {
                LoginId = loginId,
                EntityType = entityType,
                EntityId = entityId,
                FollowedAt = DateTime.UtcNow
            };
            
            db.UserFollow.Add(follow);
            await db.SaveChangesAsync();
            return follow.Id;
        }

        public async Task<bool> Unfollow(int loginId, FollowEntityType entityType, int entityId)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            
            var follow = await db.UserFollow
                .FirstOrDefaultAsync(f => f.LoginId == loginId && 
                                         f.EntityType == entityType && 
                                         f.EntityId == entityId);
            
            if (follow == null) return false;
            
            db.UserFollow.Remove(follow);
            await db.SaveChangesAsync();
            return true;
        }

        public async Task<bool> IsFollowing(int loginId, FollowEntityType entityType, int entityId)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            
            return await db.UserFollow
                .AnyAsync(f => f.LoginId == loginId && 
                              f.EntityType == entityType && 
                              f.EntityId == entityId);
        }

        public async Task<List<UserFollowViewModel>> GetUserFollows(int loginId)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            
            var follows = await db.UserFollow
                .Where(f => f.LoginId == loginId)
                .ToListAsync();

            var result = new List<UserFollowViewModel>();
            
            foreach (var follow in follows)
            {
                string entityName = await GetEntityName(db, follow.EntityType, follow.EntityId);
                result.Add(new UserFollowViewModel
                {
                    Id = follow.Id,
                    LoginId = follow.LoginId,
                    EntityType = follow.EntityType,
                    EntityId = follow.EntityId,
                    EntityName = entityName,
                    FollowedAt = follow.FollowedAt
                });
            }

            return result;
        }

        private async Task<string> GetEntityName(Db db, FollowEntityType entityType, int entityId)
        {
            switch (entityType)
            {
                case FollowEntityType.Protocol:
                    var protocol = await db.Protocol.FindAsync(entityId);
                    return protocol?.Name ?? "Unknown Protocol";
                
                case FollowEntityType.Auditor:
                    var auditor = await db.Auditor.FindAsync(entityId);
                    return auditor?.Name ?? "Unknown Auditor";
                
                case FollowEntityType.Company:
                    var company = await db.Company.FindAsync(entityId);
                    return company?.Name ?? "Unknown Company";
                
                default:
                    return "Unknown";
            }
        }
    }

    public interface IUserFollowProcessor
    {
        Task<int> Follow(int loginId, FollowEntityType entityType, int entityId);
        Task<bool> Unfollow(int loginId, FollowEntityType entityType, int entityId);
        Task<bool> IsFollowing(int loginId, FollowEntityType entityType, int entityId);
        Task<List<UserFollowViewModel>> GetUserFollows(int loginId);
    }
}

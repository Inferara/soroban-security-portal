using Microsoft.EntityFrameworkCore;
using SorobanSecurityPortalApi.Common.Data; 
using SorobanSecurityPortalApi.Models.DbModels;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace SorobanSecurityPortalApi.Data.Processors
{
    public class BadgeProcessor : IBadgeProcessor
    {
        private readonly Db _db;
        public BadgeProcessor(Db db) => _db = db;

        public async Task<List<BadgeDefinitionModel>> GetAllBadgeDefinitions() 
            => await _db.BadgeDefinitions.ToListAsync();

        public async Task<List<UserBadgeModel>> GetUserBadges(int userProfileId)
        {
            return await _db.UserBadges
                .Where(x => x.UserProfileId == userProfileId)
                .Include(x => x.Badge)
                .ToListAsync();
        }

        public async Task<bool> HasBadge(int userProfileId, int badgeId) 
        {
            return await _db.UserBadges
                .AnyAsync(x => x.UserProfileId == userProfileId && x.BadgeId == badgeId);
        }

        public async Task<bool> AwardBadge(int userProfileId, int badgeId)
        {
            if (await HasBadge(userProfileId, badgeId)) return false;

            var userBadge = new UserBadgeModel
            {
                UserProfileId = userProfileId, 
                BadgeId = badgeId,
                AwardedAt = DateTime.UtcNow
            };

            _db.UserBadges.Add(userBadge);
            return await _db.SaveChangesAsync() > 0;
        }
    }
}

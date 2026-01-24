using Microsoft.EntityFrameworkCore;
using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Models.DbModels;

namespace SorobanSecurityPortalApi.Data.Processors
{
    public class UserProfileProcessor : IUserProfileProcessor
    {
        private readonly IDbContextFactory<Db> _dbFactory;

        public UserProfileProcessor(IDbContextFactory<Db> dbFactory)
        {
            _dbFactory = dbFactory;
        }

        public async Task<UserProfileModel?> GetByIdAsync(int id)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            return await db.UserProfiles
                .AsNoTracking()
                .Include(up => up.Login)
                .FirstOrDefaultAsync(up => up.Id == id);
        }

        public async Task<UserProfileModel?> GetByLoginIdAsync(int loginId)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            return await db.UserProfiles
                .AsNoTracking()
                .Include(up => up.Login)
                .FirstOrDefaultAsync(up => up.LoginId == loginId);
        }

        public async Task<UserProfileModel> CreateAsync(UserProfileModel profile)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();

            profile.CreatedAt = DateTime.UtcNow;
            profile.UpdatedAt = DateTime.UtcNow;

            await db.UserProfiles.AddAsync(profile);
            await db.SaveChangesAsync();

            return profile;
        }

        public async Task<UserProfileModel> UpdateAsync(UserProfileModel profile)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();

            var existingProfile = await db.UserProfiles
                .FirstOrDefaultAsync(up => up.Id == profile.Id);

            if (existingProfile == null)
                throw new InvalidOperationException("Profile not found");

            profile.UpdatedAt = DateTime.UtcNow;
            db.Entry(existingProfile).CurrentValues.SetValues(profile);

            db.UserProfiles.Update(existingProfile);
            await db.SaveChangesAsync();

            return profile;
        }

        public async Task DeleteAsync(int id)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();

            var profile = await db.UserProfiles.FirstOrDefaultAsync(up => up.Id == id);
            if (profile == null) return;

            db.UserProfiles.Remove(profile);
            await db.SaveChangesAsync();
        }

        public async Task<bool> ExistsAsync(int loginId)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            return await db.UserProfiles
                .AsNoTracking()
                .AnyAsync(up => up.LoginId == loginId);
        }
    }

    public interface IUserProfileProcessor
    {
        Task<UserProfileModel?> GetByIdAsync(int id);
        Task<UserProfileModel?> GetByLoginIdAsync(int loginId);
        Task<UserProfileModel> CreateAsync(UserProfileModel profile);
        Task<UserProfileModel> UpdateAsync(UserProfileModel profile);
        Task DeleteAsync(int id);
        Task<bool> ExistsAsync(int loginId);
    }
}
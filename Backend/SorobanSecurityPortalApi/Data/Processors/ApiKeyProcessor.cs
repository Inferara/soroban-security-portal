using Microsoft.EntityFrameworkCore;
using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Models.DbModels;

namespace SorobanSecurityPortalApi.Data.Processors
{
    public class ApiKeyProcessor : IApiKeyProcessor
    {
        private readonly IDbContextFactory<Db> _dbFactory;

        public ApiKeyProcessor(IDbContextFactory<Db> dbFactory)
        {
            _dbFactory = dbFactory;
        }

        public async Task<ApiKeyModel> Add(ApiKeyModel key)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            db.ApiKey.Add(key);
            await db.SaveChangesAsync();
            return key;
        }

        public async Task<List<ApiKeyModel>> ListByLogin(int loginId)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            return await db.ApiKey
                .AsNoTracking()
                .Where(k => k.LoginId == loginId)
                .OrderByDescending(k => k.Id)
                .ToListAsync();
        }

        public async Task<int> CountActiveByLogin(int loginId, ApiKeyKind kind)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            return await db.ApiKey.CountAsync(k => k.LoginId == loginId && k.Kind == kind && k.RevokedAt == null);
        }

        public async Task<List<ApiKeyWithOwner>> ListAll()
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            return await db.ApiKey
                .AsNoTracking()
                .OrderByDescending(k => k.Id)
                .Select(k => new ApiKeyWithOwner
                {
                    Key = k,
                    OwnerName = k.Login != null ? k.Login.FullName : "",
                    OwnerLogin = k.Login != null ? k.Login.Login : "",
                })
                .ToListAsync();
        }

        // The lookup done on every public API call. Returns the key only while it is usable:
        // not revoked and owned by an enabled user.
        public async Task<ApiKeyModel?> FindUsableByHash(string keyHash)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            return await db.ApiKey
                .AsNoTracking()
                .Where(k => k.KeyHash == keyHash && k.RevokedAt == null && k.Login != null && k.Login.IsEnabled)
                .FirstOrDefaultAsync();
        }

        // Revokes a key. With ownerLoginId set, only that user's key can be revoked.
        // Returns false when there is no such key (or it belongs to someone else).
        public async Task<bool> Revoke(int keyId, int? ownerLoginId)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var key = await db.ApiKey.FirstOrDefaultAsync(k => k.Id == keyId && (ownerLoginId == null || k.LoginId == ownerLoginId));
            if (key == null) return false;
            if (key.RevokedAt == null)
            {
                key.RevokedAt = DateTime.UtcNow;
                await db.SaveChangesAsync();
            }
            return true;
        }

        public async Task TouchLastUsed(int keyId, DateTime usedAt)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            await db.ApiKey
                .Where(k => k.Id == keyId)
                .ExecuteUpdateAsync(s => s.SetProperty(k => k.LastUsedAt, usedAt));
        }
    }

    public class ApiKeyWithOwner
    {
        public ApiKeyModel Key { get; set; } = new();
        public string OwnerName { get; set; } = "";
        public string OwnerLogin { get; set; } = "";
    }

    public interface IApiKeyProcessor
    {
        Task<ApiKeyModel> Add(ApiKeyModel key);
        Task<List<ApiKeyModel>> ListByLogin(int loginId);
        Task<int> CountActiveByLogin(int loginId, ApiKeyKind kind);
        Task<List<ApiKeyWithOwner>> ListAll();
        Task<ApiKeyModel?> FindUsableByHash(string keyHash);
        Task<bool> Revoke(int keyId, int? ownerLoginId);
        Task TouchLastUsed(int keyId, DateTime usedAt);
    }
}

using Microsoft.Extensions.Caching.Memory;
using SorobanSecurityPortalApi.Models.DbModels;

namespace SorobanSecurityPortalApi.Services.PublicApi
{
    // Short-lived cache of key lookups, so a client that keeps calling (including one that is being
    // refused, or one guessing keys) costs about one database query per window instead of one per
    // request.
    //
    // Revoking a key evicts it at once. Disabling a user is not evicted: it takes effect within
    // the time-to-live (30 seconds).
    public sealed class ApiKeyLookupCache : IDisposable
    {
        public static readonly TimeSpan FoundTimeToLive = TimeSpan.FromSeconds(30);
        public static readonly TimeSpan MissingTimeToLive = TimeSpan.FromSeconds(15);

        // Found and missing keys live in separate caches with their own entry limits, so a flood of
        // random keys can never push out the entries of real ones.
        private readonly MemoryCache _found = new(new MemoryCacheOptions { SizeLimit = 5_000 });
        private readonly MemoryCache _missing = new(new MemoryCacheOptions { SizeLimit = 20_000 });

        public async Task<ApiKeyModel?> GetAsync(string keyHash, Func<Task<ApiKeyModel?>> load)
        {
            if (_found.TryGetValue(keyHash, out ApiKeyModel? known)) return known;
            if (_missing.TryGetValue(keyHash, out _)) return null;

            var loaded = await load();
            if (loaded != null)
                _found.Set(keyHash, loaded, new MemoryCacheEntryOptions { AbsoluteExpirationRelativeToNow = FoundTimeToLive, Size = 1 });
            else
                _missing.Set(keyHash, true, new MemoryCacheEntryOptions { AbsoluteExpirationRelativeToNow = MissingTimeToLive, Size = 1 });
            return loaded;
        }

        public void Evict(string keyHash)
        {
            _found.Remove(keyHash);
        }

        public void Dispose()
        {
            _found.Dispose();
            _missing.Dispose();
        }
    }
}

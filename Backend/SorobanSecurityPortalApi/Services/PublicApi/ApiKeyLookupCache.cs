using Microsoft.Extensions.Caching.Memory;
using SorobanSecurityPortalApi.Models.DbModels;

namespace SorobanSecurityPortalApi.Services.PublicApi
{
    // Short-lived cache of key lookups, so a client that keeps calling (including one that is being
    // refused, or one guessing keys) costs about one database query per window instead of one per
    // request.
    //
    // A key that is revoked, or whose owner is disabled or deleted, must stop working at once:
    //  - Evict(hash) (revoke) drops the entry and leaves a tombstone, so a lookup that was already
    //    in flight when the key was revoked cannot put it back in the cache;
    //  - Clear() (a user was disabled or deleted) drops every entry.
    public sealed class ApiKeyLookupCache : IDisposable
    {
        public static readonly TimeSpan FoundTimeToLive = TimeSpan.FromSeconds(30);
        public static readonly TimeSpan MissingTimeToLive = TimeSpan.FromSeconds(15);
        // Longer than FoundTimeToLive and any lookup, so a tombstone outlives every stale load.
        public static readonly TimeSpan TombstoneTimeToLive = TimeSpan.FromMinutes(2);

        // Found, missing and revoked keys live in separate caches with their own entry limits, so a
        // flood of random keys can never push out the entries of real ones.
        private readonly MemoryCache _found = new(new MemoryCacheOptions { SizeLimit = 5_000 });
        private readonly MemoryCache _missing = new(new MemoryCacheOptions { SizeLimit = 20_000 });
        private readonly MemoryCache _revoked = new(new MemoryCacheOptions { SizeLimit = 5_000 });

        // Bumped by Clear(): a lookup that started before it must not cache its (possibly stale) result.
        private long _generation;

        public async Task<ApiKeyModel?> GetAsync(string keyHash, Func<Task<ApiKeyModel?>> load)
        {
            if (_revoked.TryGetValue(keyHash, out _)) return null;
            if (_found.TryGetValue(keyHash, out ApiKeyModel? known)) return known;
            if (_missing.TryGetValue(keyHash, out _)) return null;

            var generation = Interlocked.Read(ref _generation);
            var loaded = await load();

            // Revoked, or the cache was cleared, while we were loading: what we read may be stale,
            // so do not cache it, and do not let a revoked key through.
            if (_revoked.TryGetValue(keyHash, out _)) return null;
            if (Interlocked.Read(ref _generation) != generation) return loaded;

            if (loaded != null)
                _found.Set(keyHash, loaded, new MemoryCacheEntryOptions { AbsoluteExpirationRelativeToNow = FoundTimeToLive, Size = 1 });
            else
                _missing.Set(keyHash, true, new MemoryCacheEntryOptions { AbsoluteExpirationRelativeToNow = MissingTimeToLive, Size = 1 });
            return loaded;
        }

        public void Evict(string keyHash)
        {
            _revoked.Set(keyHash, true, new MemoryCacheEntryOptions { AbsoluteExpirationRelativeToNow = TombstoneTimeToLive, Size = 1 });
            _found.Remove(keyHash);
        }

        // A user was disabled or deleted: every cached key may now be unusable. The next request
        // for each key asks the database again (one query per active key).
        public void Clear()
        {
            Interlocked.Increment(ref _generation);
            _found.Clear();
            _missing.Clear();
        }

        public void Dispose()
        {
            _found.Dispose();
            _missing.Dispose();
            _revoked.Dispose();
        }
    }
}

using Microsoft.Extensions.Caching.Memory;

namespace SorobanSecurityPortalApi.Common.Caching
{
    // Stable cache keys for the read-heavy, rarely-changing lookup lists used by list/filter UIs.
    public static class LookupCacheKeys
    {
        public const string Protocols = "lookup:protocols";
        public const string Companies = "lookup:companies";
        public const string Auditors = "lookup:auditors";
        public const string Tags = "lookup:tags";
        public const string Sources = "lookup:sources";
        public const string Reports = "lookup:reports";
    }

    // Thin cache-aside wrapper over IMemoryCache for lookup data. Default TTL is a backstop;
    // callers also evict explicitly on write. A throwing factory caches nothing.
    public interface ILookupCache
    {
        Task<T> GetOrCreateAsync<T>(string key, Func<Task<T>> factory, TimeSpan? ttl = null);
        void Remove(string key);
    }

    public class LookupCache : ILookupCache
    {
        private static readonly TimeSpan DefaultTtl = TimeSpan.FromMinutes(10);
        private readonly IMemoryCache _cache;

        public LookupCache(IMemoryCache cache) => _cache = cache;

        public async Task<T> GetOrCreateAsync<T>(string key, Func<Task<T>> factory, TimeSpan? ttl = null)
        {
            if (_cache.TryGetValue(key, out T? cached))
                return cached!;
            var value = await factory();
            _cache.Set(key, value, new MemoryCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = ttl ?? DefaultTtl
            });
            return value;
        }

        public void Remove(string key) => _cache.Remove(key);
    }
}

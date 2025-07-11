using Microsoft.Extensions.Caching.Distributed;

namespace SorobanSecurityPortalApi.Common
{
    public class CacheAccessor: ICacheAccessor
    {
        private readonly IDistributedCache _distributedCache;
        public CacheAccessor(IDistributedCache distributedCache)
        {
            _distributedCache = distributedCache;
        }

        public string KeyPrefix { get; set; } = "";

        public string GetCacheValue(string cacheKey)
        {
            var cacheValue = _distributedCache.GetString(KeyPrefix + cacheKey);
            return cacheValue ?? string.Empty;
        }

        public string SetCacheValue(string cacheKey, string value, int ttlInSeconds = 0)
        {
            var cacheOptions = new DistributedCacheEntryOptions();
            if (ttlInSeconds > 0)
            {
                cacheOptions.AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(ttlInSeconds);
            }
            _distributedCache.SetString(KeyPrefix + cacheKey, value, cacheOptions);
            return value;
        }
    }

    public interface ICacheAccessor
    {
        string KeyPrefix { get; set; }
        string GetCacheValue(string cacheKey);
        string SetCacheValue(string cacheKey, string value, int ttlInSeconds = 0);
    }
}

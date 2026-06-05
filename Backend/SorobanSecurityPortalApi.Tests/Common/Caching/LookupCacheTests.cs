using Microsoft.Extensions.Caching.Memory;
using SorobanSecurityPortalApi.Common.Caching;
using Xunit;

namespace SorobanSecurityPortalApi.Tests.Common.Caching
{
    public class LookupCacheTests
    {
        private static LookupCache Create() =>
            new(new MemoryCache(new MemoryCacheOptions()));

        [Fact]
        public async Task GetOrCreateAsync_RunsFactoryOnce_ThenServesFromCache()
        {
            var cache = Create();
            var calls = 0;
            Func<Task<int>> factory = () => { calls++; return Task.FromResult(42); };

            var a = await cache.GetOrCreateAsync("k", factory);
            var b = await cache.GetOrCreateAsync("k", factory);

            a.Should().Be(42);
            b.Should().Be(42);
            calls.Should().Be(1);
        }

        [Fact]
        public async Task Remove_ForcesFactoryToRunAgain()
        {
            var cache = Create();
            var calls = 0;
            Func<Task<int>> factory = () => { calls++; return Task.FromResult(calls); };

            await cache.GetOrCreateAsync("k", factory);
            cache.Remove("k");
            var afterRemove = await cache.GetOrCreateAsync("k", factory);

            calls.Should().Be(2);
            afterRemove.Should().Be(2);
        }

        [Fact]
        public async Task GetOrCreateAsync_DoesNotCacheWhenFactoryThrows()
        {
            var cache = Create();
            Func<Task<int>> bad = () => throw new InvalidOperationException("boom");

            await Assert.ThrowsAsync<InvalidOperationException>(() => cache.GetOrCreateAsync("k", bad));
            var ok = await cache.GetOrCreateAsync("k", () => Task.FromResult(7));
            ok.Should().Be(7);
        }
    }
}

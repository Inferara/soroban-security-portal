using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using FluentAssertions;
using SorobanSecurityPortalApi.Common.Security;
using SorobanSecurityPortalApi.Services.PublicApi;
using Xunit;

namespace SorobanSecurityPortalApi.Tests.PublicApi
{
    public class ApiKeyGeneratorTests
    {
        [Fact]
        public void Generate_Produces_Prefixed_Base62_Keys_That_Differ()
        {
            var keys = Enumerable.Range(0, 200).Select(_ => ApiKeyGenerator.Generate()).ToList();

            keys.Should().OnlyHaveUniqueItems();
            keys.Should().OnlyContain(k => k.Length == 44 && k.StartsWith("ssp_") && ApiKeyGenerator.LooksLikeKey(k));
        }

        [Fact]
        public void Hash_Is_Stable_Lowercase_Sha256_And_Never_The_Key()
        {
            var key = ApiKeyGenerator.Generate();

            var hash = ApiKeyGenerator.Hash(key);

            hash.Should().HaveLength(64).And.MatchRegex("^[0-9a-f]{64}$");
            hash.Should().Be(ApiKeyGenerator.Hash(key));
            hash.Should().NotContain(key[4..]);
            ApiKeyGenerator.Hash(key + "x").Should().NotBe(hash);
        }

        [Fact]
        public void DisplayPrefix_Shows_Only_The_First_Twelve_Characters()
        {
            var key = ApiKeyGenerator.Generate();
            ApiKeyGenerator.DisplayPrefix(key).Should().Be(key[..12]);
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("ssp_short")]
        [InlineData("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature")] // a JWT
        [InlineData("xxx_0123456789012345678901234567890123456789")]           // wrong prefix
        [InlineData("ssp_01234567890123456789012345678901234567-9")]           // bad character
        [InlineData("ssp_01234567890123456789012345678901234567890")]          // too long
        public void LooksLikeKey_Rejects_Anything_That_Is_Not_A_Key(string? value)
        {
            ApiKeyGenerator.LooksLikeKey(value).Should().BeFalse();
        }
    }

    public class ApiRateLimiterTests
    {
        private sealed class FakeTime : TimeProvider
        {
            public DateTimeOffset Now { get; set; } = new(2026, 11, 12, 10, 0, 5, TimeSpan.Zero);
            public override DateTimeOffset GetUtcNow() => Now;
        }

        private static readonly Func<DateTime, Task<int>> NoHistory = _ => Task.FromResult(0);

        [Fact]
        public async Task Allows_Up_To_The_Per_Minute_Limit_Then_Refuses_With_Seconds_To_Next_Minute()
        {
            var time = new FakeTime();
            var limiter = new ApiRateLimiter(time);
            var limits = new ApiRateLimits(PerMinute: 3, PerDay: 100, GlobalPerMinute: 100);

            for (var i = 0; i < 3; i++)
                (await limiter.TryAcquireAsync("k:1", limits, NoHistory, true)).Allowed.Should().BeTrue();
            var refused = await limiter.TryAcquireAsync("k:1", limits, NoHistory, true);

            refused.Allowed.Should().BeFalse();
            refused.Kind.Should().Be(ApiRateLimitKind.PerMinute);
            refused.Limit.Should().Be(3);
            refused.RetryAfterSeconds.Should().Be(55); // 10:00:05 -> 10:01:00
        }

        [Fact]
        public async Task A_New_Minute_Restores_The_Per_Minute_Allowance()
        {
            var time = new FakeTime();
            var limiter = new ApiRateLimiter(time);
            var limits = new ApiRateLimits(1, 100, 100);

            (await limiter.TryAcquireAsync("k:1", limits, NoHistory, true)).Allowed.Should().BeTrue();
            (await limiter.TryAcquireAsync("k:1", limits, NoHistory, true)).Allowed.Should().BeFalse();
            time.Now = time.Now.AddSeconds(60);

            (await limiter.TryAcquireAsync("k:1", limits, NoHistory, true)).Allowed.Should().BeTrue();
        }

        [Fact]
        public async Task Keys_Do_Not_Share_Their_Own_Allowance()
        {
            var limiter = new ApiRateLimiter(new FakeTime());
            var limits = new ApiRateLimits(1, 100, 100);

            (await limiter.TryAcquireAsync("k:1", limits, NoHistory, true)).Allowed.Should().BeTrue();
            (await limiter.TryAcquireAsync("k:1", limits, NoHistory, true)).Allowed.Should().BeFalse();

            (await limiter.TryAcquireAsync("k:2", limits, NoHistory, true)).Allowed.Should().BeTrue();
        }

        [Fact]
        public async Task Daily_Limit_Holds_Across_Minutes_And_Resets_At_Utc_Midnight()
        {
            var time = new FakeTime { Now = new DateTimeOffset(2026, 11, 12, 23, 58, 0, TimeSpan.Zero) };
            var limiter = new ApiRateLimiter(time);
            var limits = new ApiRateLimits(PerMinute: 10, PerDay: 2, GlobalPerMinute: 100);

            (await limiter.TryAcquireAsync("k:1", limits, NoHistory, true)).Allowed.Should().BeTrue();
            time.Now = time.Now.AddMinutes(1);
            (await limiter.TryAcquireAsync("k:1", limits, NoHistory, true)).Allowed.Should().BeTrue();
            var refused = await limiter.TryAcquireAsync("k:1", limits, NoHistory, true);

            refused.Allowed.Should().BeFalse();
            refused.Kind.Should().Be(ApiRateLimitKind.PerDay);
            refused.RetryAfterSeconds.Should().Be(60); // 23:59:00 -> 00:00:00

            time.Now = time.Now.AddMinutes(1);
            (await limiter.TryAcquireAsync("k:1", limits, NoHistory, true)).Allowed.Should().BeTrue();
        }

        [Fact]
        public async Task Daily_Count_Is_Seeded_From_History_So_A_Restart_Does_Not_Reset_The_Quota()
        {
            // A fresh limiter is what the API has right after a restart.
            var limiter = new ApiRateLimiter(new FakeTime());
            var limits = new ApiRateLimits(10, PerDay: 5, 100);
            var seededFor = new List<DateTime>();
            Task<int> History(DateTime dayStart)
            {
                seededFor.Add(dayStart);
                return Task.FromResult(4); // four calls already logged today
            }

            (await limiter.TryAcquireAsync("k:1", limits, History, true)).Allowed.Should().BeTrue();
            var refused = await limiter.TryAcquireAsync("k:1", limits, History, true);

            refused.Allowed.Should().BeFalse();
            refused.Kind.Should().Be(ApiRateLimitKind.PerDay);
            seededFor.Should().Equal(new DateTime(2026, 11, 12, 0, 0, 0, DateTimeKind.Utc)); // asked once, for today
        }

        [Fact]
        public async Task Global_Cap_Applies_Across_Keys_And_Does_Not_Consume_The_Refused_Keys_Quota()
        {
            var time = new FakeTime();
            var limiter = new ApiRateLimiter(time);
            var limits = new ApiRateLimits(PerMinute: 5, PerDay: 2, GlobalPerMinute: 2);

            (await limiter.TryAcquireAsync("k:1", limits, NoHistory, true)).Allowed.Should().BeTrue();
            (await limiter.TryAcquireAsync("k:2", limits, NoHistory, true)).Allowed.Should().BeTrue();
            var refused = await limiter.TryAcquireAsync("k:3", limits, NoHistory, true);

            refused.Allowed.Should().BeFalse();
            refused.Kind.Should().Be(ApiRateLimitKind.Global);

            // Key 3 was refused globally twice; its daily quota of 2 must still be whole.
            (await limiter.TryAcquireAsync("k:3", limits, NoHistory, true)).Allowed.Should().BeFalse();
            time.Now = time.Now.AddMinutes(1);
            (await limiter.TryAcquireAsync("k:3", limits, NoHistory, true)).Allowed.Should().BeTrue();
            (await limiter.TryAcquireAsync("k:3", limits, NoHistory, true)).Allowed.Should().BeTrue();
        }

        [Fact]
        public async Task A_Call_That_Does_Not_Count_Globally_Is_Not_Stopped_By_Or_Counted_In_The_Global_Cap()
        {
            var limiter = new ApiRateLimiter(new FakeTime());
            var limits = new ApiRateLimits(PerMinute: 10, PerDay: 100, GlobalPerMinute: 1);

            (await limiter.TryAcquireAsync("k:1", limits, NoHistory, countsGlobally: true)).Allowed.Should().BeTrue(); // uses the one global slot
            (await limiter.TryAcquireAsync("k:2", limits, NoHistory, countsGlobally: true)).Kind.Should().Be(ApiRateLimitKind.Global);

            (await limiter.TryAcquireAsync("k:2", limits, NoHistory, countsGlobally: false)).Allowed.Should().BeTrue();
        }

        [Fact]
        public async Task Two_Names_For_One_Scope_Share_The_Allowance()
        {
            // The runner gives every personal key of a user the same scope; the limiter just counts per scope.
            var limiter = new ApiRateLimiter(new FakeTime());
            var limits = new ApiRateLimits(PerMinute: 2, PerDay: 100, GlobalPerMinute: 100);

            (await limiter.TryAcquireAsync("u:42", limits, NoHistory, true)).Allowed.Should().BeTrue();
            (await limiter.TryAcquireAsync("u:42", limits, NoHistory, true)).Allowed.Should().BeTrue();
            (await limiter.TryAcquireAsync("u:42", limits, NoHistory, true)).Allowed.Should().BeFalse();
        }

        [Fact]
        public async Task Concurrent_Calls_Never_Exceed_The_Limit()
        {
            var limiter = new ApiRateLimiter(new FakeTime());
            var limits = new ApiRateLimits(PerMinute: 50, PerDay: 1000, GlobalPerMinute: 1000);

            var results = await Task.WhenAll(Enumerable.Range(0, 200)
                .Select(_ => Task.Run(() => limiter.TryAcquireAsync("k:1", limits, NoHistory, true))));

            results.Count(r => r.Allowed).Should().Be(50);
        }
    }
}

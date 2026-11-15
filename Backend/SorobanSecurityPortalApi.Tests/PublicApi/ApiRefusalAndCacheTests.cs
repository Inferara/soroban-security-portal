using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Services.PublicApi;
using Xunit;

namespace SorobanSecurityPortalApi.Tests.PublicApi
{
    public class ApiRefusalAggregatorTests
    {
        private sealed class FakeTime : TimeProvider
        {
            public DateTimeOffset Now { get; set; } = new(2026, 11, 12, 10, 0, 5, TimeSpan.Zero);
            public override DateTimeOffset GetUtcNow() => Now;
        }

        private static readonly ApiCaller Caller = new(7, 42, ApiKeyKind.Personal, null, null);

        [Fact]
        public void Every_Refusal_Is_Counted_Even_When_Thousands_Arrive()
        {
            var time = new FakeTime();
            var aggregator = new ApiRefusalAggregator(time);

            for (var i = 0; i < 5000; i++)
                aggregator.Record(Caller, ApiUsageSource.Rest, "list_protocols");
            time.Now = time.Now.AddMinutes(3);
            var rows = aggregator.Drain(all: false);

            // One row, with the exact count: nothing is sampled away.
            var row = rows.Should().ContainSingle().Subject;
            row.Count.Should().Be(5000);
            row.Status.Should().Be(ApiUsageStatus.RateLimited);
            row.ApiKeyId.Should().Be(7);
            row.LoginId.Should().Be(42);
            row.Operation.Should().Be("list_protocols");
            row.CreatedAt.Should().Be(new DateTime(2026, 11, 12, 10, 0, 0, DateTimeKind.Utc)); // start of the minute
        }

        [Fact]
        public void Rows_Are_Split_By_Key_Operation_Source_And_Minute()
        {
            var time = new FakeTime();
            var aggregator = new ApiRefusalAggregator(time);

            aggregator.Record(Caller, ApiUsageSource.Rest, "a");
            aggregator.Record(Caller, ApiUsageSource.Rest, "a");
            aggregator.Record(Caller, ApiUsageSource.Mcp, "a");
            aggregator.Record(Caller, ApiUsageSource.Rest, "b");
            aggregator.Record(new ApiCaller(8, 43, ApiKeyKind.Personal, null, null), ApiUsageSource.Rest, "a");
            time.Now = time.Now.AddMinutes(1);
            aggregator.Record(Caller, ApiUsageSource.Rest, "a");
            time.Now = time.Now.AddMinutes(5);

            var rows = aggregator.Drain(all: false);

            rows.Should().HaveCount(5);
            rows.Sum(r => r.Count).Should().Be(6);
            rows.Single(r => r.ApiKeyId == 7 && r.Source == ApiUsageSource.Rest && r.Operation == "a" && r.CreatedAt.Minute == 0).Count.Should().Be(2);
        }

        [Fact]
        public void The_Current_And_The_Previous_Minute_Are_Left_Alone_Until_They_Are_Over()
        {
            var time = new FakeTime();
            var aggregator = new ApiRefusalAggregator(time);
            aggregator.Record(Caller, ApiUsageSource.Rest, "a");

            aggregator.Drain(all: false).Should().BeEmpty(); // same minute
            time.Now = time.Now.AddMinutes(1);
            aggregator.Drain(all: false).Should().BeEmpty(); // grace period: a call may still be adding to it
            time.Now = time.Now.AddMinutes(1);
            aggregator.Drain(all: false).Should().ContainSingle();
        }

        [Fact]
        public void Draining_Takes_Rows_Out_So_They_Are_Written_Once()
        {
            var time = new FakeTime();
            var aggregator = new ApiRefusalAggregator(time);
            aggregator.Record(Caller, ApiUsageSource.Rest, "a");
            time.Now = time.Now.AddMinutes(5);

            aggregator.Drain(all: false).Should().ContainSingle();
            aggregator.Drain(all: false).Should().BeEmpty();
        }

        [Fact]
        public void Shutdown_Takes_Everything_Including_The_Current_Minute()
        {
            var aggregator = new ApiRefusalAggregator(new FakeTime());
            aggregator.Record(Caller, ApiUsageSource.Rest, "a");

            aggregator.Drain(all: true).Should().ContainSingle().Which.Count.Should().Be(1);
        }

        [Fact]
        public void Rows_That_Failed_To_Write_Are_Restored_And_Merge_With_New_Refusals()
        {
            var time = new FakeTime();
            var aggregator = new ApiRefusalAggregator(time);
            aggregator.Record(Caller, ApiUsageSource.Rest, "a");
            aggregator.Record(Caller, ApiUsageSource.Rest, "a");
            time.Now = time.Now.AddMinutes(5);
            var rows = aggregator.Drain(all: false);

            aggregator.Restore(rows);
            aggregator.Restore(rows); // restoring the same minute twice adds up
            var again = aggregator.Drain(all: false);

            again.Should().ContainSingle().Which.Count.Should().Be(4);
        }

        [Fact]
        public async Task Concurrent_Refusals_Are_All_Counted()
        {
            var aggregator = new ApiRefusalAggregator(new FakeTime());

            await Task.WhenAll(Enumerable.Range(0, 8).Select(_ => Task.Run(() =>
            {
                for (var i = 0; i < 2000; i++) aggregator.Record(Caller, ApiUsageSource.Rest, "a");
            })));

            aggregator.Drain(all: true).Should().ContainSingle().Which.Count.Should().Be(16000);
        }

        [Fact]
        public void A_Service_Key_Without_An_Issuer_Is_Recorded_With_User_Zero()
        {
            var aggregator = new ApiRefusalAggregator(new FakeTime());
            aggregator.Record(new ApiCaller(11, null, ApiKeyKind.Service, null, null), ApiUsageSource.Mcp, "a");

            aggregator.Drain(all: true).Should().ContainSingle().Which.LoginId.Should().Be(0);
        }
    }

    public class ApiKeyLookupCacheTests
    {
        private static ApiKeyModel Key() => new() { Id = 1, LoginId = 42 };

        [Fact]
        public async Task A_Key_Is_Loaded_Once_Within_The_Window()
        {
            var cache = new ApiKeyLookupCache();
            var loads = 0;
            Task<ApiKeyModel?> Load() { loads++; return Task.FromResult<ApiKeyModel?>(Key()); }

            for (var i = 0; i < 100; i++)
                (await cache.GetAsync("hash", Load)).Should().NotBeNull();

            loads.Should().Be(1);
        }

        [Fact]
        public async Task An_Unknown_Key_Is_Not_Looked_Up_Again_Either()
        {
            var cache = new ApiKeyLookupCache();
            var loads = 0;
            Task<ApiKeyModel?> Load() { loads++; return Task.FromResult<ApiKeyModel?>(null); }

            for (var i = 0; i < 100; i++)
                (await cache.GetAsync("random-guess", Load)).Should().BeNull();

            loads.Should().Be(1);
        }

        [Fact]
        public async Task Evicting_A_Key_Refuses_It_At_Once_Without_Asking_The_Database_Again()
        {
            var cache = new ApiKeyLookupCache();
            var usable = true;
            var loads = 0;
            Task<ApiKeyModel?> Load() { loads++; return Task.FromResult(usable ? Key() : null); }

            (await cache.GetAsync("hash", Load)).Should().NotBeNull();
            usable = false; // revoked in the database
            (await cache.GetAsync("hash", Load)).Should().NotBeNull(); // still cached: stale until evicted
            cache.Evict("hash");

            (await cache.GetAsync("hash", Load)).Should().BeNull();
            loads.Should().Be(1); // refused from the tombstone, without a second query
        }

        [Fact]
        public async Task A_Lookup_That_Was_In_Flight_When_The_Key_Was_Revoked_Cannot_Bring_It_Back()
        {
            var cache = new ApiKeyLookupCache();

            // The query read the key as usable, then the revoke ran (and evicted) before the lookup returned.
            var result = await cache.GetAsync("hash", async () =>
            {
                var read = Key();
                cache.Evict("hash");
                await Task.Yield();
                return read;
            });

            result.Should().BeNull();
            var loads = 0;
            (await cache.GetAsync("hash", () => { loads++; return Task.FromResult<ApiKeyModel?>(Key()); })).Should().BeNull();
            loads.Should().Be(0); // refused from the tombstone, without asking the database
        }

        [Fact]
        public async Task A_Revoked_Key_Stays_Refused_For_The_Whole_Tombstone_Window_Even_If_The_Database_Is_Stale()
        {
            var cache = new ApiKeyLookupCache();
            await cache.GetAsync("hash", () => Task.FromResult<ApiKeyModel?>(Key()));

            cache.Evict("hash");

            (await cache.GetAsync("hash", () => Task.FromResult<ApiKeyModel?>(Key()))).Should().BeNull();
        }

        [Fact]
        public async Task Clear_Drops_Every_Entry_So_A_Disabled_Users_Keys_Are_Checked_Again()
        {
            var cache = new ApiKeyLookupCache();
            var usable = true;
            var loads = 0;
            Task<ApiKeyModel?> Load() { loads++; return Task.FromResult(usable ? Key() : null); }
            await cache.GetAsync("a", Load);
            await cache.GetAsync("b", Load);
            usable = false; // the owner was disabled

            cache.Clear();

            (await cache.GetAsync("a", Load)).Should().BeNull();
            (await cache.GetAsync("b", Load)).Should().BeNull();
            loads.Should().Be(4);
        }

        [Fact]
        public async Task A_Lookup_In_Flight_During_Clear_Is_Not_Cached()
        {
            var cache = new ApiKeyLookupCache();
            var loads = 0;

            await cache.GetAsync("hash", async () =>
            {
                loads++;
                cache.Clear(); // a user was disabled while this lookup ran
                await Task.Yield();
                return Key();
            });
            await cache.GetAsync("hash", () => { loads++; return Task.FromResult<ApiKeyModel?>(null); });

            loads.Should().Be(2); // the stale result was not cached, so the second call asked again
        }

        [Fact]
        public async Task A_Flood_Of_Unknown_Keys_Does_Not_Push_Out_A_Real_One()
        {
            var cache = new ApiKeyLookupCache();
            var realLoads = 0;
            Task<ApiKeyModel?> LoadReal() { realLoads++; return Task.FromResult<ApiKeyModel?>(Key()); }
            await cache.GetAsync("real", LoadReal);

            for (var i = 0; i < 30_000; i++)
                await cache.GetAsync($"random-{i}", () => Task.FromResult<ApiKeyModel?>(null));
            await cache.GetAsync("real", LoadReal);

            realLoads.Should().Be(1);
        }
    }
}

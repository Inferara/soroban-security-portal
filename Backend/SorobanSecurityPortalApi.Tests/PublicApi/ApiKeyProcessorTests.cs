using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Moq;
using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Tests.Services; // TestAsyncQueryProvider<T> / TestAsyncEnumerator<T>
using Xunit;

namespace SorobanSecurityPortalApi.Tests.PublicApi
{
    // Who may use a key, and what counts against whose daily allowance.
    public class ApiKeyProcessorTests
    {
        private static Mock<DbSet<T>> CreateDbSetMock<T>(List<T> source) where T : class
        {
            var q = source.AsQueryable();
            var m = new Mock<DbSet<T>>();
            m.As<IQueryable<T>>().Setup(x => x.Provider).Returns(new TestAsyncQueryProvider<T>(q.Provider));
            m.As<IQueryable<T>>().Setup(x => x.Expression).Returns(q.Expression);
            m.As<IQueryable<T>>().Setup(x => x.ElementType).Returns(q.ElementType);
            m.As<IQueryable<T>>().Setup(x => x.GetEnumerator()).Returns(q.GetEnumerator());
            m.As<IAsyncEnumerable<T>>().Setup(x => x.GetAsyncEnumerator(It.IsAny<CancellationToken>()))
                .Returns(new TestAsyncEnumerator<T>(q.GetEnumerator()));
            return m;
        }

        private static IDbContextFactory<Db> Factory(List<ApiKeyModel>? keys = null, List<ApiUsageLogModel>? usage = null)
        {
            var dbMock = new Mock<Db>(
                new Mock<IDbQuery>().Object,
                new Mock<Microsoft.Extensions.Logging.ILogger<Db>>().Object,
                new Mock<IDataSourceProvider>().Object) { CallBase = true };
            dbMock.Setup(d => d.ApiKey).Returns(CreateDbSetMock(keys ?? new()).Object);
            dbMock.Setup(d => d.ApiUsageLog).Returns(CreateDbSetMock(usage ?? new()).Object);
            var factory = new Mock<IDbContextFactory<Db>>();
            factory.Setup(f => f.CreateDbContextAsync(It.IsAny<CancellationToken>())).ReturnsAsync(dbMock.Object);
            return factory.Object;
        }

        private static ApiKeyModel Key(ApiKeyKind kind, LoginModel? login, bool revoked = false) => new()
        {
            Id = 1,
            KeyHash = "hash",
            Kind = kind,
            LoginId = login?.LoginId,
            Login = login,
            RevokedAt = revoked ? DateTime.UtcNow : null,
        };

        private static LoginModel Login(bool enabled = true) => new() { LoginId = 42, IsEnabled = enabled };

        [Fact]
        public async Task A_Personal_Key_Of_An_Enabled_User_Is_Usable()
        {
            var processor = new ApiKeyProcessor(Factory(new() { Key(ApiKeyKind.Personal, Login()) }));

            (await processor.FindUsableByHash("hash")).Should().NotBeNull();
        }

        [Fact]
        public async Task A_Personal_Key_Of_A_Disabled_User_Is_Not_Usable()
        {
            var processor = new ApiKeyProcessor(Factory(new() { Key(ApiKeyKind.Personal, Login(enabled: false)) }));

            (await processor.FindUsableByHash("hash")).Should().BeNull();
        }

        [Fact]
        public async Task A_Personal_Key_Without_An_Owner_Is_Not_Usable()
        {
            var processor = new ApiKeyProcessor(Factory(new() { Key(ApiKeyKind.Personal, null) }));

            (await processor.FindUsableByHash("hash")).Should().BeNull();
        }

        [Fact]
        public async Task A_Service_Key_Survives_Its_Issuer_Being_Disabled()
        {
            var processor = new ApiKeyProcessor(Factory(new() { Key(ApiKeyKind.Service, Login(enabled: false)) }));

            (await processor.FindUsableByHash("hash")).Should().NotBeNull();
        }

        [Fact]
        public async Task A_Service_Key_Survives_Its_Issuer_Being_Deleted()
        {
            var processor = new ApiKeyProcessor(Factory(new() { Key(ApiKeyKind.Service, null) }));

            (await processor.FindUsableByHash("hash")).Should().NotBeNull();
        }

        [Theory]
        [InlineData(ApiKeyKind.Personal)]
        [InlineData(ApiKeyKind.Service)]
        public async Task A_Revoked_Key_Is_Never_Usable(ApiKeyKind kind)
        {
            var processor = new ApiKeyProcessor(Factory(new() { Key(kind, Login(), revoked: true) }));

            (await processor.FindUsableByHash("hash")).Should().BeNull();
        }

        [Fact]
        public async Task A_Different_Hash_Finds_Nothing()
        {
            var processor = new ApiKeyProcessor(Factory(new() { Key(ApiKeyKind.Personal, Login()) }));

            (await processor.FindUsableByHash("other")).Should().BeNull();
        }

        [Fact]
        public async Task Daily_Count_For_A_User_Sums_All_Their_Personal_Keys_And_Nothing_Else()
        {
            var now = DateTime.UtcNow;
            var dayStart = now.Date;
            ApiUsageLogModel Row(int keyId, int loginId, ApiUsageStatus status = ApiUsageStatus.Ok, DateTime? at = null) =>
                new() { ApiKeyId = keyId, LoginId = loginId, Status = status, CreatedAt = at ?? now };
            var keys = new List<ApiKeyModel>
            {
                new() { Id = 1, Kind = ApiKeyKind.Personal, LoginId = 42 },
                new() { Id = 2, Kind = ApiKeyKind.Personal, LoginId = 42 },    // a second key of the same user, maybe revoked
                new() { Id = 3, Kind = ApiKeyKind.Service, LoginId = 42 },     // a service key the same person issued
                new() { Id = 4, Kind = ApiKeyKind.Personal, LoginId = 43 },
            };
            var usage = new List<ApiUsageLogModel>
            {
                Row(1, 42), Row(1, 42), Row(2, 42),                      // 3 counted: two keys, one user
                Row(1, 42, ApiUsageStatus.RateLimited),                  // refusals do not count
                Row(1, 42, at: dayStart.AddSeconds(-1)),                 // yesterday
                Row(3, 42),                                              // service key: counts against that key
                Row(4, 43),                                              // someone else
            };
            var processor = new ApiUsageLogProcessor(Factory(keys, usage));

            (await processor.CountCountedForLoginSince(42, dayStart)).Should().Be(3);
            (await processor.CountCountedSince(3, dayStart)).Should().Be(1);
        }
    }
}

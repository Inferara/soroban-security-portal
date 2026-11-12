using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using FluentAssertions;
using Moq;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Common.Security;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;
using SorobanSecurityPortalApi.Services.PublicApi;
using Xunit;
using static SorobanSecurityPortalApi.Common.ExceptionHandlingMiddleware;

namespace SorobanSecurityPortalApi.Tests.PublicApi
{
    public class ApiKeyServiceTests
    {
        private readonly Mock<IApiKeyProcessor> _apiKeys = new();
        private readonly Mock<IApiUsageLogProcessor> _usageLog = new();
        private readonly Mock<IUserContextAccessor> _userContext = new();
        private readonly Mock<IExtendedConfig> _config = new();
        private ApiKeyModel? _stored;

        public ApiKeyServiceTests()
        {
            _userContext.Setup(u => u.GetLoginIdOrNullAsync()).ReturnsAsync(42);
            _apiKeys.Setup(k => k.Add(It.IsAny<ApiKeyModel>()))
                .Callback<ApiKeyModel>(k => { k.Id = 1; _stored = k; })
                .ReturnsAsync((ApiKeyModel k) => k);
        }

        private ApiKeyService Build() => new(_apiKeys.Object, _usageLog.Object, _userContext.Object, _config.Object);

        [Fact]
        public async Task Create_Returns_The_Key_Once_And_Stores_Only_Its_Hash_And_Prefix()
        {
            var result = await Build().CreateMine(new CreateApiKeyRequest { Name = "  laptop  " });

            var created = result.Should().BeOfType<Result<CreatedApiKeyViewModel, string>.Ok>().Subject.Value;
            ApiKeyGenerator.LooksLikeKey(created.Key).Should().BeTrue();
            created.Name.Should().Be("laptop");
            created.KeyPrefix.Should().Be(created.Key[..12]);

            _stored!.LoginId.Should().Be(42);
            _stored.Kind.Should().Be(ApiKeyKind.Personal);
            _stored.KeyHash.Should().Be(ApiKeyGenerator.Hash(created.Key));
            _stored.KeyHash.Should().NotContain(created.Key);
            _stored.RateLimitPerMinute.Should().BeNull();
            // Nothing on the stored row lets anyone rebuild the key.
            typeof(ApiKeyModel).GetProperties().Select(p => p.Name).Should().NotContain("Key");
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("   ")]
        public async Task Create_Requires_A_Name(string? name)
        {
            var result = await Build().CreateMine(new CreateApiKeyRequest { Name = name });

            result.Should().BeOfType<Result<CreatedApiKeyViewModel, string>.Err>();
            _apiKeys.Verify(k => k.Add(It.IsAny<ApiKeyModel>()), Times.Never);
        }

        [Fact]
        public async Task Create_Rejects_An_Overlong_Name()
        {
            var result = await Build().CreateMine(new CreateApiKeyRequest { Name = new string('n', 101) });

            result.Should().BeOfType<Result<CreatedApiKeyViewModel, string>.Err>();
        }

        [Fact]
        public async Task Create_Stops_At_Five_Active_Personal_Keys()
        {
            _apiKeys.Setup(k => k.CountActiveByLogin(42, ApiKeyKind.Personal)).ReturnsAsync(5);

            var result = await Build().CreateMine(new CreateApiKeyRequest { Name = "sixth" });

            result.Should().BeOfType<Result<CreatedApiKeyViewModel, string>.Err>().Which.Error.Should().Contain("5 active");
            _apiKeys.Verify(k => k.Add(It.IsAny<ApiKeyModel>()), Times.Never);
        }

        [Fact]
        public async Task Anonymous_Callers_Cannot_Manage_Keys()
        {
            _userContext.Setup(u => u.GetLoginIdOrNullAsync()).ReturnsAsync((int?)null);

            await ((Func<Task>)(() => Build().ListMine())).Should().ThrowAsync<SorobanSecurityPortalAuthException>();
            await ((Func<Task>)(() => Build().CreateMine(new CreateApiKeyRequest { Name = "x" }))).Should().ThrowAsync<SorobanSecurityPortalAuthException>();
            await ((Func<Task>)(() => Build().RevokeMine(1))).Should().ThrowAsync<SorobanSecurityPortalAuthException>();
        }

        [Fact]
        public async Task A_User_Can_Only_Revoke_Their_Own_Keys()
        {
            _apiKeys.Setup(k => k.Revoke(9, 42)).ReturnsAsync(false); // key 9 belongs to someone else

            (await Build().RevokeMine(9)).Should().BeFalse();
            _apiKeys.Verify(k => k.Revoke(9, 42), Times.Once);
            _apiKeys.Verify(k => k.Revoke(It.IsAny<int>(), null), Times.Never);
        }

        [Fact]
        public async Task Admin_Revoke_Is_Not_Restricted_To_An_Owner()
        {
            _apiKeys.Setup(k => k.Revoke(9, null)).ReturnsAsync(true);

            (await Build().RevokeAny(9)).Should().BeTrue();
        }

        [Fact]
        public async Task Service_Key_Carries_Its_Own_Limits()
        {
            var result = await Build().CreateService(new CreateServiceApiKeyRequest { Name = "Raven", RateLimitPerMinute = 300, RateLimitPerDay = 50000 });

            result.Should().BeOfType<Result<CreatedApiKeyViewModel, string>.Ok>();
            _stored!.Kind.Should().Be(ApiKeyKind.Service);
            _stored.RateLimitPerMinute.Should().Be(300);
            _stored.RateLimitPerDay.Should().Be(50000);
        }

        [Theory]
        [InlineData(0, 10)]
        [InlineData(-5, 10)]
        [InlineData(10, 0)]
        [InlineData(1_000_000, 10)]
        public async Task Service_Key_Rejects_Nonsense_Limits(int perMinute, int perDay)
        {
            var result = await Build().CreateService(new CreateServiceApiKeyRequest { Name = "Raven", RateLimitPerMinute = perMinute, RateLimitPerDay = perDay });

            result.Should().BeOfType<Result<CreatedApiKeyViewModel, string>.Err>();
        }

        [Fact]
        public async Task Listing_Never_Includes_Hashes()
        {
            _apiKeys.Setup(k => k.ListByLogin(42)).ReturnsAsync(new List<ApiKeyModel>
            {
                new() { Id = 1, Name = "a", KeyPrefix = "ssp_AAAAAAAA", KeyHash = new string('f', 64) },
            });

            var list = await Build().ListMine();

            list.Should().ContainSingle();
            typeof(ApiKeyViewModel).GetProperties().Select(p => p.Name).Should().NotContain(new[] { "KeyHash", "Key" });
        }

        [Fact]
        public async Task Statistics_Cover_Whole_Utc_Days_Including_Today_And_Clamp_The_Range()
        {
            DateTime from = default, to = default;
            _usageLog.Setup(u => u.GetStatistics(It.IsAny<DateTime>(), It.IsAny<DateTime>()))
                .Callback<DateTime, DateTime>((f, t) => { from = f; to = t; })
                .ReturnsAsync(new ApiUsageStatisticsViewModel());

            await Build().GetStatistics(7);
            to.Should().Be(DateTime.UtcNow.Date.AddDays(1));
            (to - from).TotalDays.Should().Be(7);

            await Build().GetStatistics(100000);
            (to - from).TotalDays.Should().Be(366);

            await Build().GetStatistics(-4);
            (to - from).TotalDays.Should().Be(1);
        }

        [Fact]
        public async Task Csv_Has_A_Header_Stable_Status_Names_And_Safe_Text_Cells()
        {
            _usageLog.Setup(u => u.Export(It.IsAny<DateTime>(), It.IsAny<DateTime>(), It.IsAny<int>())).ReturnsAsync(new List<ApiUsageExportRow>
            {
                new()
                {
                    CreatedAt = new DateTime(2026, 11, 12, 9, 30, 0, DateTimeKind.Utc),
                    Source = ApiUsageSource.Mcp,
                    Operation = "search_vulnerabilities",
                    Status = ApiUsageStatus.RateLimited,
                    DurationMs = 12,
                    ApiKeyId = 3,
                    KeyName = "Raven, \"prod\"",
                    KeyKind = ApiKeyKind.Service,
                    LoginId = 1,
                    Arguments = "=HYPERLINK(\"http://evil\")\nquery=x",
                },
            });

            var lines = (await Build().ExportCsv(30)).TrimEnd('\n').Split('\n');

            lines[0].Should().Be("timestamp_utc,source,operation,status,duration_ms,api_key_id,api_key_name,api_key_kind,user_id,arguments");
            lines.Should().HaveCount(2); // the newline inside the argument did not split the row
            lines[1].Should().Be(
                "2026-11-12T09:30:00Z,mcp,\"search_vulnerabilities\",rate_limited,12,3,\"Raven, \"\"prod\"\"\",service,1,"
                + "\"'=HYPERLINK(\"\"http://evil\"\") query=x\"");
        }
    }
}

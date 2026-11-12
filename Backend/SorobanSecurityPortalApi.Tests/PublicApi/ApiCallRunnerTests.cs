using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Services.PublicApi;
using Xunit;

namespace SorobanSecurityPortalApi.Tests.PublicApi
{
    // The runner is the single gate in front of every public operation: master switch, limits,
    // usage log. These tests pin that behaviour for both transports.
    public class ApiCallRunnerTests
    {
        private readonly Mock<IApiCallerAccessor> _caller = new();
        private readonly Mock<IApiRateLimiter> _limiter = new();
        private readonly Mock<IApiUsageLogProcessor> _usageLog = new();
        private readonly Mock<IApiKeyProcessor> _apiKeys = new();
        private readonly Mock<IExtendedConfig> _config = new();
        private readonly List<ApiUsageLogModel> _logged = new();
        private ApiRateLimits? _limitsUsed;

        public ApiCallRunnerTests()
        {
            _caller.Setup(c => c.GetCaller()).Returns(new ApiCaller(7, 42, null, null));
            _config.SetupGet(c => c.PublicApiEnabled).Returns(true);
            _config.SetupGet(c => c.PublicApiRateLimitPerMinute).Returns(60);
            _config.SetupGet(c => c.PublicApiRateLimitPerDay).Returns(2000);
            _config.SetupGet(c => c.PublicApiGlobalRateLimitPerMinute).Returns(600);
            _limiter.Setup(l => l.TryAcquireAsync(It.IsAny<int>(), It.IsAny<ApiRateLimits>(), It.IsAny<Func<DateTime, Task<int>>>()))
                .Callback<int, ApiRateLimits, Func<DateTime, Task<int>>>((_, limits, _) => _limitsUsed = limits)
                .ReturnsAsync(ApiRateLimitDecision.Ok);
            _usageLog.Setup(u => u.Add(It.IsAny<ApiUsageLogModel>()))
                .Callback<ApiUsageLogModel>(_logged.Add)
                .Returns(Task.CompletedTask);
        }

        private ApiCallRunner Build() => new(
            _caller.Object, _limiter.Object, _usageLog.Object, _apiKeys.Object, _config.Object,
            new MemoryCache(new MemoryCacheOptions()), NullLogger<ApiCallRunner>.Instance);

        [Fact]
        public async Task Successful_Call_Returns_The_Value_And_Logs_It()
        {
            var outcome = await Build().Run(ApiUsageSource.Mcp, "get_vulnerability", "id=5", () => Task.FromResult<string?>("data"));

            outcome.Status.Should().Be(ApiCallStatus.Ok);
            outcome.Value.Should().Be("data");
            _logged.Should().ContainSingle().Which.Should().BeEquivalentTo(new
            {
                ApiKeyId = 7,
                LoginId = 42,
                Source = ApiUsageSource.Mcp,
                Operation = "get_vulnerability",
                Arguments = "id=5",
                Status = ApiUsageStatus.Ok,
            });
            _apiKeys.Verify(k => k.TouchLastUsed(7, It.IsAny<DateTime>()), Times.Once);
        }

        [Fact]
        public async Task Without_An_Api_Key_Nothing_Runs_And_Nothing_Is_Logged()
        {
            _caller.Setup(c => c.GetCaller()).Returns((ApiCaller?)null);
            var ran = false;

            var outcome = await Build().Run(ApiUsageSource.Rest, "list_protocols", null, () => { ran = true; return Task.FromResult<string?>("x"); });

            outcome.Status.Should().Be(ApiCallStatus.Unauthorized);
            ran.Should().BeFalse();
            _logged.Should().BeEmpty();
        }

        [Fact]
        public async Task Master_Switch_Off_Refuses_Without_Spending_Quota()
        {
            _config.SetupGet(c => c.PublicApiEnabled).Returns(false);
            var ran = false;

            var outcome = await Build().Run(ApiUsageSource.Rest, "list_protocols", null, () => { ran = true; return Task.FromResult<string?>("x"); });

            outcome.Status.Should().Be(ApiCallStatus.Disabled);
            ran.Should().BeFalse();
            _limiter.VerifyNoOtherCalls();
        }

        [Fact]
        public async Task Over_The_Limit_The_Operation_Does_Not_Run_And_The_Refusal_Is_Logged()
        {
            _limiter.Setup(l => l.TryAcquireAsync(It.IsAny<int>(), It.IsAny<ApiRateLimits>(), It.IsAny<Func<DateTime, Task<int>>>()))
                .ReturnsAsync(new ApiRateLimitDecision(false, ApiRateLimitKind.PerMinute, 60, 17));
            var ran = false;

            var outcome = await Build().Run(ApiUsageSource.Mcp, "search_vulnerabilities", "query=x", () => { ran = true; return Task.FromResult<string?>("x"); });

            outcome.Status.Should().Be(ApiCallStatus.RateLimited);
            outcome.RetryAfterSeconds.Should().Be(17);
            outcome.Message.Should().Contain("60 calls per minute").And.Contain("17 seconds");
            ran.Should().BeFalse();
            _logged.Should().ContainSingle().Which.Status.Should().Be(ApiUsageStatus.RateLimited);
        }

        [Fact]
        public async Task A_Client_Hammering_After_Refusal_Cannot_Flood_The_Usage_Log()
        {
            _limiter.Setup(l => l.TryAcquireAsync(It.IsAny<int>(), It.IsAny<ApiRateLimits>(), It.IsAny<Func<DateTime, Task<int>>>()))
                .ReturnsAsync(new ApiRateLimitDecision(false, ApiRateLimitKind.PerMinute, 60, 17));
            var runner = Build();

            for (var i = 0; i < 500; i++)
            {
                var outcome = await runner.Run(ApiUsageSource.Rest, "list_protocols", null, () => Task.FromResult<string?>("x"));
                outcome.Status.Should().Be(ApiCallStatus.RateLimited); // still refused every time
            }

            // 500 refusals, but only a bounded number of rows (the run may straddle a minute boundary).
            _logged.Count.Should().BeInRange(ApiCallRunner.MaxLoggedRefusalsPerMinute, ApiCallRunner.MaxLoggedRefusalsPerMinute * 2);
        }

        [Fact]
        public async Task Default_Limits_Come_From_Settings()
        {
            await Build().Run(ApiUsageSource.Rest, "list_protocols", null, () => Task.FromResult<string?>("x"));

            _limitsUsed.Should().Be(new ApiRateLimits(60, 2000, 600));
        }

        [Fact]
        public async Task A_Service_Keys_Own_Limits_Override_The_Defaults()
        {
            _caller.Setup(c => c.GetCaller()).Returns(new ApiCaller(7, 42, RateLimitPerMinute: 500, RateLimitPerDay: 100000));

            await Build().Run(ApiUsageSource.Rest, "list_protocols", null, () => Task.FromResult<string?>("x"));

            _limitsUsed.Should().Be(new ApiRateLimits(500, 100000, 600));
        }

        [Fact]
        public async Task Null_Result_Is_NotFound()
        {
            var outcome = await Build().Run(ApiUsageSource.Rest, "get_report", "id=1", () => Task.FromResult<string?>(null));

            outcome.Status.Should().Be(ApiCallStatus.NotFound);
            _logged.Should().ContainSingle().Which.Status.Should().Be(ApiUsageStatus.NotFound);
        }

        [Fact]
        public async Task Validation_Error_Reaches_The_Caller_With_Its_Message()
        {
            var outcome = await Build().Run<string>(ApiUsageSource.Rest, "search_vulnerabilities", null,
                () => throw new PublicApiValidationException("Unknown severity 'urgent'."));

            outcome.Status.Should().Be(ApiCallStatus.BadRequest);
            outcome.Message.Should().Be("Unknown severity 'urgent'.");
            _logged.Should().ContainSingle().Which.Status.Should().Be(ApiUsageStatus.BadRequest);
        }

        [Fact]
        public async Task Unexpected_Error_Is_Logged_And_Its_Details_Are_Not_Leaked()
        {
            var outcome = await Build().Run<string>(ApiUsageSource.Rest, "search_vulnerabilities", null,
                () => throw new InvalidOperationException("connection string: Host=db;Password=secret"));

            outcome.Status.Should().Be(ApiCallStatus.Error);
            outcome.Message.Should().NotContain("secret");
            _logged.Should().ContainSingle().Which.Status.Should().Be(ApiUsageStatus.Error);
        }

        [Fact]
        public async Task A_Failing_Usage_Log_Does_Not_Fail_The_Call()
        {
            _usageLog.Setup(u => u.Add(It.IsAny<ApiUsageLogModel>())).ThrowsAsync(new Exception("db down"));

            var outcome = await Build().Run(ApiUsageSource.Rest, "list_protocols", null, () => Task.FromResult<string?>("x"));

            outcome.Status.Should().Be(ApiCallStatus.Ok);
        }

        [Fact]
        public async Task Long_Arguments_Are_Truncated_In_The_Log()
        {
            await Build().Run(ApiUsageSource.Rest, "search_vulnerabilities", new string('a', 1000), () => Task.FromResult<string?>("x"));

            _logged.Should().ContainSingle().Which.Arguments.Should().HaveLength(300);
        }

        [Fact]
        public async Task Last_Used_Is_Written_At_Most_Once_A_Minute_Per_Key()
        {
            var runner = Build();

            for (var i = 0; i < 5; i++)
                await runner.Run(ApiUsageSource.Rest, "list_protocols", null, () => Task.FromResult<string?>("x"));

            _apiKeys.Verify(k => k.TouchLastUsed(7, It.IsAny<DateTime>()), Times.Once);
        }
    }
}

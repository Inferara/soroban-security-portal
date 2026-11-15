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
        private static readonly ApiCaller PersonalCaller = new(7, 42, ApiKeyKind.Personal, null, null);

        private readonly Mock<IApiCallerAccessor> _caller = new();
        private readonly Mock<IApiRateLimiter> _limiter = new();
        private readonly Mock<IApiRefusalAggregator> _refusals = new();
        private readonly Mock<IApiUsageLogProcessor> _usageLog = new();
        private readonly Mock<IApiKeyProcessor> _apiKeys = new();
        private readonly Mock<IExtendedConfig> _config = new();
        private readonly List<ApiUsageLogModel> _logged = new();
        private string? _scopeUsed;
        private ApiRateLimits? _limitsUsed;
        private Func<DateTime, Task<int>>? _seedUsed;

        public ApiCallRunnerTests()
        {
            _caller.Setup(c => c.GetCaller()).Returns(PersonalCaller);
            _config.SetupGet(c => c.PublicApiEnabled).Returns(true);
            _config.SetupGet(c => c.PublicApiRateLimitPerMinute).Returns(60);
            _config.SetupGet(c => c.PublicApiRateLimitPerDay).Returns(2000);
            _config.SetupGet(c => c.PublicApiGlobalRateLimitPerMinute).Returns(600);
            _config.SetupGet(c => c.RetRateLimitPerMinute).Returns(6);
            _config.SetupGet(c => c.RetRateLimitPerDay).Returns(100);
            _limiter.Setup(l => l.TryAcquireAsync(It.IsAny<string>(), It.IsAny<ApiRateLimits>(), It.IsAny<Func<DateTime, Task<int>>>(), It.IsAny<bool>()))
                .Callback<string, ApiRateLimits, Func<DateTime, Task<int>>, bool>((scope, limits, seed, _) =>
                {
                    _scopeUsed = scope;
                    _limitsUsed = limits;
                    _seedUsed = seed;
                })
                .ReturnsAsync(ApiRateLimitDecision.Ok);
            _usageLog.Setup(u => u.Add(It.IsAny<ApiUsageLogModel>()))
                .Callback<ApiUsageLogModel>(_logged.Add)
                .Returns(Task.CompletedTask);
        }

        private ApiCallRunner Build() => new(
            _caller.Object, _limiter.Object, _refusals.Object, _usageLog.Object, _apiKeys.Object, _config.Object,
            new MemoryCache(new MemoryCacheOptions()), NullLogger<ApiCallRunner>.Instance);

        private void LimiterRefuses(ApiRateLimitDecision decision) =>
            _limiter.Setup(l => l.TryAcquireAsync(It.IsAny<string>(), It.IsAny<ApiRateLimits>(), It.IsAny<Func<DateTime, Task<int>>>(), It.IsAny<bool>()))
                .ReturnsAsync(decision);

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
                Count = 1,
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
        public async Task Over_The_Limit_The_Operation_Does_Not_Run_And_The_Refusal_Is_Counted()
        {
            LimiterRefuses(new ApiRateLimitDecision(false, ApiRateLimitKind.PerMinute, 60, 17));
            var ran = false;

            var outcome = await Build().Run(ApiUsageSource.Mcp, "search_vulnerabilities", "query=x", () => { ran = true; return Task.FromResult<string?>("x"); });

            outcome.Status.Should().Be(ApiCallStatus.RateLimited);
            outcome.RetryAfterSeconds.Should().Be(17);
            outcome.Message.Should().Contain("60 calls per minute").And.Contain("17 seconds");
            ran.Should().BeFalse();
            _refusals.Verify(r => r.Record(PersonalCaller, ApiUsageSource.Mcp, "search_vulnerabilities"), Times.Once);
        }

        [Fact]
        public async Task A_Client_Hammering_After_Refusal_Costs_No_Database_Write_Per_Request()
        {
            LimiterRefuses(new ApiRateLimitDecision(false, ApiRateLimitKind.PerMinute, 60, 17));
            var runner = Build();

            for (var i = 0; i < 500; i++)
            {
                var outcome = await runner.Run(ApiUsageSource.Rest, "list_protocols", null, () => Task.FromResult<string?>("x"));
                outcome.Status.Should().Be(ApiCallStatus.RateLimited); // refused every time
            }

            _refusals.Verify(r => r.Record(It.IsAny<ApiCaller>(), It.IsAny<ApiUsageSource>(), It.IsAny<string>()), Times.Exactly(500));
            _usageLog.Verify(u => u.Add(It.IsAny<ApiUsageLogModel>()), Times.Never);
            _usageLog.Verify(u => u.AddRange(It.IsAny<IEnumerable<ApiUsageLogModel>>()), Times.Never);
            _apiKeys.VerifyNoOtherCalls();
        }

        [Fact]
        public async Task Personal_Keys_Of_One_User_Share_One_Allowance()
        {
            await Build().Run(ApiUsageSource.Rest, "list_protocols", null, () => Task.FromResult<string?>("x"));
            var firstKeyScope = _scopeUsed;
            _caller.Setup(c => c.GetCaller()).Returns(new ApiCaller(99, 42, ApiKeyKind.Personal, null, null)); // same user, another key
            await Build().Run(ApiUsageSource.Rest, "list_protocols", null, () => Task.FromResult<string?>("x"));

            firstKeyScope.Should().Be("u:42");
            _scopeUsed.Should().Be("u:42");
        }

        [Fact]
        public async Task Different_Users_Have_Separate_Allowances()
        {
            await Build().Run(ApiUsageSource.Rest, "list_protocols", null, () => Task.FromResult<string?>("x"));
            _caller.Setup(c => c.GetCaller()).Returns(new ApiCaller(8, 43, ApiKeyKind.Personal, null, null));
            await Build().Run(ApiUsageSource.Rest, "list_protocols", null, () => Task.FromResult<string?>("x"));

            _scopeUsed.Should().Be("u:43");
        }

        [Fact]
        public async Task A_Service_Key_Is_Limited_On_Its_Own()
        {
            _caller.Setup(c => c.GetCaller()).Returns(new ApiCaller(11, 1, ApiKeyKind.Service, null, null));

            await Build().Run(ApiUsageSource.Rest, "list_protocols", null, () => Task.FromResult<string?>("x"));

            _scopeUsed.Should().Be("k:11");
        }

        [Fact]
        public async Task A_Service_Key_Without_An_Issuer_Still_Works_And_Is_Logged_With_No_User()
        {
            _caller.Setup(c => c.GetCaller()).Returns(new ApiCaller(11, null, ApiKeyKind.Service, null, null));

            var outcome = await Build().Run(ApiUsageSource.Rest, "list_protocols", null, () => Task.FromResult<string?>("x"));

            outcome.Status.Should().Be(ApiCallStatus.Ok);
            _logged.Should().ContainSingle().Which.LoginId.Should().Be(0);
        }

        [Fact]
        public async Task Daily_Allowance_Is_Seeded_From_The_Right_Place()
        {
            _usageLog.Setup(u => u.CountCountedForLoginSince(42, It.IsAny<DateTime>())).ReturnsAsync(17);
            _usageLog.Setup(u => u.CountCountedSince(11, It.IsAny<DateTime>())).ReturnsAsync(5);
            var day = new DateTime(2026, 11, 12, 0, 0, 0, DateTimeKind.Utc);

            await Build().Run(ApiUsageSource.Rest, "list_protocols", null, () => Task.FromResult<string?>("x"));
            (await _seedUsed!(day)).Should().Be(17); // personal: everything the user did with any of their keys

            _caller.Setup(c => c.GetCaller()).Returns(new ApiCaller(11, 1, ApiKeyKind.Service, null, null));
            await Build().Run(ApiUsageSource.Rest, "list_protocols", null, () => Task.FromResult<string?>("x"));
            (await _seedUsed!(day)).Should().Be(5); // service: that key only
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
            _caller.Setup(c => c.GetCaller()).Returns(new ApiCaller(11, 1, ApiKeyKind.Service, RateLimitPerMinute: 500, RateLimitPerDay: 100000));

            await Build().Run(ApiUsageSource.Rest, "list_protocols", null, () => Task.FromResult<string?>("x"));

            _limitsUsed.Should().Be(new ApiRateLimits(500, 100000, 600));
        }

        [Fact]
        public async Task A_Personal_Key_Cannot_Raise_Its_Own_Limits()
        {
            // Claims that look like overrides on a personal key are ignored.
            _caller.Setup(c => c.GetCaller()).Returns(new ApiCaller(7, 42, ApiKeyKind.Personal, RateLimitPerMinute: 99999, RateLimitPerDay: 99999));

            await Build().Run(ApiUsageSource.Rest, "list_protocols", null, () => Task.FromResult<string?>("x"));

            _limitsUsed.Should().Be(new ApiRateLimits(60, 2000, 600));
        }

        // ---- decompiler calls: an extra, stricter allowance ----

        private List<(string Scope, ApiRateLimits Limits, bool Global)> CaptureLimiterCalls()
        {
            var calls = new List<(string, ApiRateLimits, bool)>();
            _limiter.Setup(l => l.TryAcquireAsync(It.IsAny<string>(), It.IsAny<ApiRateLimits>(), It.IsAny<Func<DateTime, Task<int>>>(), It.IsAny<bool>()))
                .Callback<string, ApiRateLimits, Func<DateTime, Task<int>>, bool>((scope, limits, seed, g) =>
                {
                    calls.Add((scope, limits, g));
                    _seedUsed = seed;
                })
                .ReturnsAsync(ApiRateLimitDecision.Ok);
            return calls;
        }

        [Fact]
        public async Task A_Decompiler_Call_Must_Fit_The_General_Limit_And_Its_Own_Stricter_One()
        {
            var calls = CaptureLimiterCalls();

            await Build().Run(ApiUsageSource.Mcp, "ret_decompile_address", "address=C", () => Task.FromResult<string?>("x"));

            calls.Should().HaveCount(2);
            calls[0].Should().Be(("ret:u:42", new ApiRateLimits(6, 100, int.MaxValue), false)); // own allowance, not the global cap; checked first
            calls[1].Should().Be(("u:42", new ApiRateLimits(60, 2000, 600), true));
        }

        [Theory]
        [InlineData("ret_decompile_address")]
        [InlineData("ret_decompile_wasm")]
        public async Task Both_Decompile_Operations_Are_Metered(string operation)
        {
            var calls = CaptureLimiterCalls();

            await Build().Run(ApiUsageSource.Mcp, operation, null, () => Task.FromResult<string?>("x"));

            calls.Select(c => c.Scope).Should().Equal("ret:u:42", "u:42");
        }

        [Theory]
        [InlineData("ret_versions")]
        [InlineData("search_vulnerabilities")]
        [InlineData("get_report")]
        public async Task Cheap_Operations_Only_Face_The_General_Limit(string operation)
        {
            var calls = CaptureLimiterCalls();

            await Build().Run(ApiUsageSource.Mcp, operation, null, () => Task.FromResult<string?>("x"));

            calls.Should().ContainSingle().Which.Scope.Should().Be("u:42");
        }

        [Fact]
        public async Task A_Service_Keys_Decompiler_Allowance_Is_Its_Own_Too()
        {
            _caller.Setup(c => c.GetCaller()).Returns(new ApiCaller(11, null, ApiKeyKind.Service, 500, 5000));
            var calls = CaptureLimiterCalls();

            await Build().Run(ApiUsageSource.Mcp, "ret_decompile_wasm", null, () => Task.FromResult<string?>("x"));

            calls.Select(c => c.Scope).Should().Equal("ret:k:11", "k:11");
            calls[0].Limits.Should().Be(new ApiRateLimits(6, 100, int.MaxValue)); // widening the general limits does not widen this one
        }

        [Fact]
        public async Task Over_The_Decompiler_Limit_The_Call_Is_Refused_Counted_And_Not_Run()
        {
            var calls = 0;
            _limiter.Setup(l => l.TryAcquireAsync(It.IsAny<string>(), It.IsAny<ApiRateLimits>(), It.IsAny<Func<DateTime, Task<int>>>(), It.IsAny<bool>()))
                .ReturnsAsync((string scope, ApiRateLimits _, Func<DateTime, Task<int>> _, bool _) =>
                {
                    calls++;
                    return scope.StartsWith("ret:") ? new ApiRateLimitDecision(false, ApiRateLimitKind.PerMinute, 6, 33) : ApiRateLimitDecision.Ok;
                });
            var ran = false;

            var outcome = await Build().Run(ApiUsageSource.Mcp, "ret_decompile_address", "address=C", () => { ran = true; return Task.FromResult<string?>("x"); });

            outcome.Status.Should().Be(ApiCallStatus.RateLimited);
            outcome.RetryAfterSeconds.Should().Be(33);
            outcome.Message.Should().Contain("Decompiler limit of 6 calls per minute").And.Contain("33 seconds");
            ran.Should().BeFalse();
            calls.Should().Be(1); // refused by the decompiler allowance, which is checked first: the general allowance was never touched
            _refusals.Verify(r => r.Record(PersonalCaller, ApiUsageSource.Mcp, "ret_decompile_address"), Times.Once);
            _usageLog.Verify(u => u.Add(It.IsAny<ApiUsageLogModel>()), Times.Never);
        }

        // ---- a mistake or a busy decompiler does not use up the expensive allowance ----

        [Fact]
        public async Task A_Typo_Is_Refused_And_Costs_No_Decompiler_Allowance()
        {
            var outcome = await Build().Run<string>(ApiUsageSource.Mcp, "ret_decompile_address", "address=x",
                () => throw new PublicApiValidationException("'address' must be a Stellar contract address."));

            outcome.Status.Should().Be(ApiCallStatus.BadRequest);
            _limiter.Verify(l => l.Refund("ret:u:42", It.IsAny<ApiRateLimitDecision>()), Times.Once);
        }

        [Fact]
        public async Task A_Refund_Takes_The_Call_Out_Of_The_Window_It_Was_Counted_In()
        {
            var counted = new ApiRateLimitDecision(true, ApiRateLimitKind.None, 0, 0, MinuteWindow: 123, DayWindow: 45);
            _limiter.Setup(l => l.TryAcquireAsync(It.Is<string>(s => s.StartsWith("ret:")), It.IsAny<ApiRateLimits>(), It.IsAny<Func<DateTime, Task<int>>>(), It.IsAny<bool>()))
                .ReturnsAsync(counted);

            await Build().Run<string>(ApiUsageSource.Mcp, "ret_decompile_address", null,
                () => throw new PublicApiValidationException("typo"));

            _limiter.Verify(l => l.Refund("ret:u:42", counted), Times.Once);
        }

        [Fact]
        public async Task A_Refunded_Call_Is_Logged_As_Refunded_So_A_Restart_Does_Not_Count_It_Again()
        {
            await Build().Run<string>(ApiUsageSource.Mcp, "ret_decompile_address", "address=x",
                () => throw new PublicApiValidationException("typo"));
            await Build().Run<string>(ApiUsageSource.Mcp, "ret_decompile_wasm", null,
                () => throw new PublicApiUnavailableException("busy") { ChargesAllowance = false });

            // A typo is "refunded"; a decompiler that could not take the call is a failure on our side, so it keeps counting as one.
            _logged.Select(l => l.Status).Should().Equal(ApiUsageStatus.Refunded, ApiUsageStatus.RefundedError);
        }

        [Fact]
        public async Task A_Charged_Failure_Keeps_Its_Own_Status()
        {
            await Build().Run<string>(ApiUsageSource.Mcp, "ret_decompile_wasm", null,
                () => throw new PublicApiValidationException("Could not decompile this module: bad") { ChargesAllowance = true });
            await Build().Run<string>(ApiUsageSource.Mcp, "ret_decompile_address", null,
                () => throw new PublicApiUnavailableException("took too long"));

            _logged.Select(l => l.Status).Should().Equal(ApiUsageStatus.BadRequest, ApiUsageStatus.Error);
        }

        [Fact]
        public async Task A_Typo_On_Another_Tool_Is_Logged_As_A_Plain_Bad_Request()
        {
            await Build().Run<string>(ApiUsageSource.Mcp, "search_vulnerabilities", null,
                () => throw new PublicApiValidationException("Unknown severity."));

            _logged.Should().ContainSingle().Which.Status.Should().Be(ApiUsageStatus.BadRequest);
        }

        [Fact]
        public async Task A_Busy_Decompiler_Costs_No_Allowance_Either()
        {
            await Build().Run<string>(ApiUsageSource.Mcp, "ret_decompile_wasm", null,
                () => throw new PublicApiUnavailableException("The decompiler is busy.") { ChargesAllowance = false });

            _limiter.Verify(l => l.Refund("ret:u:42", It.IsAny<ApiRateLimitDecision>()), Times.Once);
        }

        [Fact]
        public async Task A_Module_The_Decompiler_Could_Not_Read_Does_Cost_Allowance()
        {
            await Build().Run<string>(ApiUsageSource.Mcp, "ret_decompile_wasm", null,
                () => throw new PublicApiValidationException("Could not decompile this module: bad section") { ChargesAllowance = true });

            _limiter.Verify(l => l.Refund(It.IsAny<string>(), It.IsAny<ApiRateLimitDecision>()), Times.Never);
        }

        [Fact]
        public async Task A_Call_That_Timed_Out_Does_Cost_Allowance()
        {
            await Build().Run<string>(ApiUsageSource.Mcp, "ret_decompile_address", null,
                () => throw new PublicApiUnavailableException("The decompiler took too long."));

            _limiter.Verify(l => l.Refund(It.IsAny<string>(), It.IsAny<ApiRateLimitDecision>()), Times.Never);
        }

        [Fact]
        public async Task A_Successful_Call_Is_Never_Refunded()
        {
            await Build().Run(ApiUsageSource.Mcp, "ret_decompile_address", null, () => Task.FromResult<string?>("x"));

            _limiter.Verify(l => l.Refund(It.IsAny<string>(), It.IsAny<ApiRateLimitDecision>()), Times.Never);
        }

        [Fact]
        public async Task Other_Tools_Have_Nothing_To_Refund()
        {
            await Build().Run<string>(ApiUsageSource.Mcp, "search_vulnerabilities", null,
                () => throw new PublicApiValidationException("Unknown severity."));

            _limiter.Verify(l => l.Refund(It.IsAny<string>(), It.IsAny<ApiRateLimitDecision>()), Times.Never);
        }

        [Fact]
        public async Task A_Failing_Refund_Does_Not_Fail_The_Call()
        {
            _limiter.Setup(l => l.Refund(It.IsAny<string>(), It.IsAny<ApiRateLimitDecision>())).Throws(new Exception("boom"));

            var outcome = await Build().Run<string>(ApiUsageSource.Mcp, "ret_decompile_address", null,
                () => throw new PublicApiValidationException("bad"));

            outcome.Status.Should().Be(ApiCallStatus.BadRequest);
        }

        [Fact]
        public async Task With_The_Real_Limiter_Typos_Do_Not_Burn_The_Few_Expensive_Calls()
        {
            var runner = BuildWithRealLimiter(generalPerMinute: 100, retPerMinute: 2);

            for (var i = 0; i < 10; i++)
                (await runner.Run<string>(ApiUsageSource.Mcp, "ret_decompile_address", null,
                    () => throw new PublicApiValidationException("typo"))).Status.Should().Be(ApiCallStatus.BadRequest);

            // Both real calls are still available.
            (await runner.Run(ApiUsageSource.Mcp, "ret_decompile_address", null, () => Task.FromResult<string?>("x"))).Status.Should().Be(ApiCallStatus.Ok);
            (await runner.Run(ApiUsageSource.Mcp, "ret_decompile_address", null, () => Task.FromResult<string?>("x"))).Status.Should().Be(ApiCallStatus.Ok);
            (await runner.Run(ApiUsageSource.Mcp, "ret_decompile_address", null, () => Task.FromResult<string?>("x"))).Status.Should().Be(ApiCallStatus.RateLimited);
        }

        [Fact]
        public async Task The_Daily_Decompiler_Limit_Has_Its_Own_Message()
        {
            _limiter.Setup(l => l.TryAcquireAsync(It.Is<string>(s => s.StartsWith("ret:")), It.IsAny<ApiRateLimits>(), It.IsAny<Func<DateTime, Task<int>>>(), It.IsAny<bool>()))
                .ReturnsAsync(new ApiRateLimitDecision(false, ApiRateLimitKind.PerDay, 100, 4000));

            var outcome = await Build().Run(ApiUsageSource.Mcp, "ret_decompile_wasm", null, () => Task.FromResult<string?>("x"));

            outcome.Message.Should().Contain("Daily limit of 100 decompiler calls");
        }

        [Fact]
        public async Task The_Decompiler_Allowance_Is_Seeded_From_Decompile_Calls_Only()
        {
            _usageLog.Setup(u => u.CountCountedForLoginSince(42, It.IsAny<DateTime>(), "ret_decompile")).ReturnsAsync(37);
            _usageLog.Setup(u => u.CountCountedSince(11, It.IsAny<DateTime>(), "ret_decompile")).ReturnsAsync(9);
            var day = new DateTime(2026, 11, 14, 0, 0, 0, DateTimeKind.Utc);

            var seeds = new Dictionary<string, Func<DateTime, Task<int>>>();
            _limiter.Setup(l => l.TryAcquireAsync(It.IsAny<string>(), It.IsAny<ApiRateLimits>(), It.IsAny<Func<DateTime, Task<int>>>(), It.IsAny<bool>()))
                .Callback<string, ApiRateLimits, Func<DateTime, Task<int>>, bool>((scope, _, seed, _) => seeds[scope] = seed)
                .ReturnsAsync(ApiRateLimitDecision.Ok);

            await Build().Run(ApiUsageSource.Mcp, "ret_decompile_wasm", null, () => Task.FromResult<string?>("x"));
            (await seeds["ret:u:42"](day)).Should().Be(37); // decompile calls only

            _caller.Setup(c => c.GetCaller()).Returns(new ApiCaller(11, null, ApiKeyKind.Service, null, null));
            await Build().Run(ApiUsageSource.Mcp, "ret_decompile_wasm", null, () => Task.FromResult<string?>("x"));
            (await seeds["ret:k:11"](day)).Should().Be(9);
        }

        // ---- with the real limiter ----

        private ApiCallRunner BuildWithRealLimiter(int generalPerMinute, int retPerMinute)
        {
            _config.SetupGet(c => c.PublicApiRateLimitPerMinute).Returns(generalPerMinute);
            _config.SetupGet(c => c.RetRateLimitPerMinute).Returns(retPerMinute);
            _usageLog.Setup(u => u.CountCountedForLoginSince(It.IsAny<int>(), It.IsAny<DateTime>())).ReturnsAsync(0);
            _usageLog.Setup(u => u.CountCountedForLoginSince(It.IsAny<int>(), It.IsAny<DateTime>(), It.IsAny<string>())).ReturnsAsync(0);
            return new ApiCallRunner(_caller.Object, new ApiRateLimiter(), _refusals.Object, _usageLog.Object, _apiKeys.Object, _config.Object,
                new MemoryCache(new MemoryCacheOptions()), NullLogger<ApiCallRunner>.Instance);
        }

        [Fact]
        public async Task A_Call_Refused_By_The_Decompiler_Allowance_Costs_No_General_Allowance()
        {
            var runner = BuildWithRealLimiter(generalPerMinute: 8, retPerMinute: 3);
            Task<ApiCallOutcome<string>> Decompile() => runner.Run(ApiUsageSource.Mcp, "ret_decompile_wasm", null, () => Task.FromResult<string?>("x"));
            Task<ApiCallOutcome<string>> Search() => runner.Run(ApiUsageSource.Mcp, "search_vulnerabilities", null, () => Task.FromResult<string?>("x"));

            for (var i = 0; i < 3; i++) (await Decompile()).Status.Should().Be(ApiCallStatus.Ok);      // 3 of 8 general used
            for (var i = 0; i < 20; i++) (await Decompile()).Status.Should().Be(ApiCallStatus.RateLimited); // a retry loop: refused, costs nothing

            // 5 general calls are still left, so the other tools keep working.
            for (var i = 0; i < 5; i++) (await Search()).Status.Should().Be(ApiCallStatus.Ok);
            (await Search()).Status.Should().Be(ApiCallStatus.RateLimited);
        }

        [Fact]
        public async Task Cheap_Tools_Do_Not_Use_The_Decompiler_Allowance()
        {
            var runner = BuildWithRealLimiter(generalPerMinute: 100, retPerMinute: 2);

            for (var i = 0; i < 30; i++)
                (await runner.Run(ApiUsageSource.Mcp, "ret_versions", null, () => Task.FromResult<string?>("x"))).Status.Should().Be(ApiCallStatus.Ok);
            (await runner.Run(ApiUsageSource.Mcp, "ret_decompile_address", null, () => Task.FromResult<string?>("x"))).Status.Should().Be(ApiCallStatus.Ok);
            (await runner.Run(ApiUsageSource.Mcp, "ret_decompile_address", null, () => Task.FromResult<string?>("x"))).Status.Should().Be(ApiCallStatus.Ok);
            (await runner.Run(ApiUsageSource.Mcp, "ret_decompile_address", null, () => Task.FromResult<string?>("x"))).Status.Should().Be(ApiCallStatus.RateLimited);
        }

        [Fact]
        public async Task The_Two_Decompile_Tools_Share_One_Allowance()
        {
            var runner = BuildWithRealLimiter(generalPerMinute: 100, retPerMinute: 2);

            (await runner.Run(ApiUsageSource.Mcp, "ret_decompile_address", null, () => Task.FromResult<string?>("x"))).Status.Should().Be(ApiCallStatus.Ok);
            (await runner.Run(ApiUsageSource.Mcp, "ret_decompile_wasm", null, () => Task.FromResult<string?>("x"))).Status.Should().Be(ApiCallStatus.Ok);
            (await runner.Run(ApiUsageSource.Mcp, "ret_decompile_wasm", null, () => Task.FromResult<string?>("x"))).Status.Should().Be(ApiCallStatus.RateLimited);
        }

        [Fact]
        public async Task A_Failing_Decompiler_Limiter_Is_An_Error_Not_An_Unmetered_Call()
        {
            _limiter.Setup(l => l.TryAcquireAsync(It.Is<string>(s => s.StartsWith("ret:")), It.IsAny<ApiRateLimits>(), It.IsAny<Func<DateTime, Task<int>>>(), It.IsAny<bool>()))
                .ThrowsAsync(new Exception("db down"));
            var ran = false;

            var outcome = await Build().Run(ApiUsageSource.Mcp, "ret_decompile_wasm", null, () => { ran = true; return Task.FromResult<string?>("x"); });

            outcome.Status.Should().Be(ApiCallStatus.Error);
            ran.Should().BeFalse();
        }

        [Fact]
        public async Task An_Unavailable_Dependency_Is_An_Error_With_Its_Own_Plain_Message()
        {
            var outcome = await Build().Run<string>(ApiUsageSource.Mcp, "ret_decompile_address", "address=C",
                () => throw new PublicApiUnavailableException("The decompiler is busy. Try again in a moment."));

            outcome.Status.Should().Be(ApiCallStatus.Error);
            outcome.Message.Should().Be("The decompiler is busy. Try again in a moment.");
            _logged.Should().ContainSingle().Which.Status.Should().Be(ApiUsageStatus.Error);
        }

        [Fact]
        public async Task What_The_Result_Says_Is_Added_To_The_Logged_Arguments()
        {
            await Build().Run(ApiUsageSource.Mcp, "ret_decompile_address", "address=C network=mainnet",
                () => Task.FromResult<string?>("data"), r => $"engine=0.0.4 len={r.Length}");

            _logged.Should().ContainSingle().Which.Arguments.Should().Be("address=C network=mainnet engine=0.0.4 len=4");
        }

        [Fact]
        public async Task A_Failed_Call_Is_Logged_With_Its_Arguments_And_No_Result_Note()
        {
            await Build().Run<string>(ApiUsageSource.Mcp, "ret_decompile_address", "address=C",
                () => throw new PublicApiUnavailableException("down"), r => "engine=should-not-appear");

            _logged.Should().ContainSingle().Which.Arguments.Should().Be("address=C");
        }

        [Fact]
        public async Task A_Result_Note_That_Throws_Does_Not_Fail_The_Call()
        {
            var outcome = await Build().Run(ApiUsageSource.Mcp, "ret_versions", "x",
                () => Task.FromResult<string?>("data"), _ => throw new InvalidOperationException("boom"));

            outcome.Status.Should().Be(ApiCallStatus.Ok);
            _logged.Should().ContainSingle().Which.Arguments.Should().Be("x");
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

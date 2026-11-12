using System;
using System.Linq;
using System.Security.Claims;
using System.Text.Encodings.Web;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using ModelContextProtocol.Protocol;
using Moq;
using SorobanSecurityPortalApi.Authorization;
using SorobanSecurityPortalApi.Common.Security;
using SorobanSecurityPortalApi.Controllers;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Mcp;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;
using SorobanSecurityPortalApi.Services.PublicApi;
using Xunit;

namespace SorobanSecurityPortalApi.Tests.PublicApi
{
    public class ApiKeyAuthenticationHandlerTests
    {
        private readonly Mock<IApiKeyProcessor> _apiKeys = new();

        private async Task<AuthenticateResult> Authenticate(Action<HttpRequest> configure)
        {
            var options = new Mock<IOptionsMonitor<AuthenticationSchemeOptions>>();
            options.Setup(o => o.Get(It.IsAny<string>())).Returns(new AuthenticationSchemeOptions());
            var handler = new ApiKeyAuthenticationHandler(options.Object, NullLoggerFactory.Instance, UrlEncoder.Default, _apiKeys.Object);
            var context = new DefaultHttpContext();
            configure(context.Request);
            await handler.InitializeAsync(
                new AuthenticationScheme(ApiKeyAuthenticationHandler.SchemeName, null, typeof(ApiKeyAuthenticationHandler)), context);
            return await handler.AuthenticateAsync();
        }

        [Theory]
        [InlineData("/api/mcp", true)]
        [InlineData("/api/mcp/", true)]
        [InlineData("/api/public/v1/vulnerabilities", true)]
        [InlineData("/api/v1/vulnerabilities", false)]
        [InlineData("/api/v1/api-keys", false)]
        [InlineData("/api/mcpx", false)]
        [InlineData("/hubs/notifications", false)]
        public void Api_Keys_Are_Only_Accepted_On_The_Public_Surface(string path, bool expected)
        {
            ApiKeyAuthenticationHandler.IsPublicApiPath(path).Should().Be(expected);
        }

        [Fact]
        public async Task Valid_Key_In_Bearer_Header_Authenticates_Without_Any_Portal_Role()
        {
            var key = ApiKeyGenerator.Generate();
            _apiKeys.Setup(k => k.FindUsableByHash(ApiKeyGenerator.Hash(key)))
                .ReturnsAsync(new ApiKeyModel { Id = 7, LoginId = 42, RateLimitPerMinute = 300 });

            var result = await Authenticate(r => r.Headers.Authorization = $"Bearer {key}");

            result.Succeeded.Should().BeTrue();
            var principal = result.Principal!;
            principal.FindFirstValue(ApiKeyClaims.ApiKeyId).Should().Be("7");
            principal.FindFirstValue(ApiKeyClaims.LoginId).Should().Be("42");
            principal.FindFirstValue(ApiKeyClaims.RateLimitPerMinute).Should().Be("300");
            principal.FindFirstValue(ApiKeyClaims.RateLimitPerDay).Should().BeNull();
            // The portal's own checks look at these; an API key identity must have neither.
            principal.FindFirstValue(ClaimTypes.Role).Should().BeNull();
            principal.FindFirstValue(ClaimTypes.NameIdentifier).Should().BeNull();
        }

        [Fact]
        public async Task Valid_Key_In_X_Api_Key_Header_Authenticates()
        {
            var key = ApiKeyGenerator.Generate();
            _apiKeys.Setup(k => k.FindUsableByHash(ApiKeyGenerator.Hash(key))).ReturnsAsync(new ApiKeyModel { Id = 7, LoginId = 42 });

            (await Authenticate(r => r.Headers["X-API-Key"] = key)).Succeeded.Should().BeTrue();
        }

        [Fact]
        public async Task No_Key_Is_No_Result()
        {
            var result = await Authenticate(_ => { });

            result.None.Should().BeTrue();
        }

        [Fact]
        public async Task Unknown_Or_Revoked_Key_Fails()
        {
            _apiKeys.Setup(k => k.FindUsableByHash(It.IsAny<string>())).ReturnsAsync((ApiKeyModel?)null);

            var result = await Authenticate(r => r.Headers.Authorization = $"Bearer {ApiKeyGenerator.Generate()}");

            result.Succeeded.Should().BeFalse();
            result.Failure.Should().NotBeNull();
        }

        [Fact]
        public async Task A_Jwt_Or_Other_Malformed_Token_Fails_Without_Touching_The_Database()
        {
            var result = await Authenticate(r => r.Headers.Authorization = "Bearer eyJhbGciOiJIUzI1NiJ9.e30.signature");

            result.Succeeded.Should().BeFalse();
            _apiKeys.Verify(k => k.FindUsableByHash(It.IsAny<string>()), Times.Never);
        }
    }

    public class ApiCallerAccessorTests
    {
        private static ApiCaller? Caller(ClaimsPrincipal user)
        {
            var accessor = new Mock<IHttpContextAccessor>();
            accessor.SetupGet(a => a.HttpContext).Returns(new DefaultHttpContext { User = user });
            return new ApiCallerAccessor(accessor.Object).GetCaller();
        }

        [Fact]
        public void Reads_The_Caller_From_An_Api_Key_Identity()
        {
            var identity = new ClaimsIdentity(new[]
            {
                new Claim(ApiKeyClaims.ApiKeyId, "7"),
                new Claim(ApiKeyClaims.LoginId, "42"),
                new Claim(ApiKeyClaims.RateLimitPerDay, "900"),
            }, ApiKeyClaims.AuthenticationScheme);

            Caller(new ClaimsPrincipal(identity)).Should().Be(new ApiCaller(7, 42, null, 900));
        }

        [Fact]
        public void A_Portal_Session_Is_Not_An_Api_Caller()
        {
            // Same claim names, but authenticated by another scheme (a JWT session): must not count.
            var identity = new ClaimsIdentity(new[]
            {
                new Claim(ApiKeyClaims.ApiKeyId, "7"),
                new Claim(ApiKeyClaims.LoginId, "42"),
            }, "Bearer");

            Caller(new ClaimsPrincipal(identity)).Should().BeNull();
            Caller(new ClaimsPrincipal(new ClaimsIdentity())).Should().BeNull();
        }
    }

    public class PublicApiControllerTests
    {
        private readonly Mock<IPublicApiService> _service = new();
        private readonly Mock<IApiCallRunner> _runner = new();

        private PublicApiController Build() => new(_service.Object, _runner.Object)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() },
        };

        private void RunnerReturns<T>(ApiCallOutcome<T> outcome) where T : class =>
            _runner.Setup(r => r.Run(It.IsAny<ApiUsageSource>(), It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<Func<Task<T?>>>()))
                .ReturnsAsync(outcome);

        [Fact]
        public void The_Controller_Accepts_Api_Keys_Only()
        {
            var authorize = typeof(PublicApiController).GetCustomAttributes(typeof(AuthorizeAttribute), true).Cast<AuthorizeAttribute>().Single();

            authorize.AuthenticationSchemes.Should().Be(ApiKeyAuthenticationHandler.SchemeName);
        }

        [Fact]
        public void Every_Endpoint_Is_A_Get()
        {
            var actions = typeof(PublicApiController).GetMethods()
                .Where(m => m.DeclaringType == typeof(PublicApiController) && m.IsPublic);

            actions.Should().NotBeEmpty().And.OnlyContain(m => m.GetCustomAttributes(typeof(HttpGetAttribute), true).Any());
        }

        [Fact]
        public async Task Ok_Returns_The_Value()
        {
            var page = new PublicVulnerabilityPage { Total = 3 };
            RunnerReturns(new ApiCallOutcome<PublicVulnerabilityPage> { Status = ApiCallStatus.Ok, Value = page });

            var result = await Build().SearchVulnerabilities("q", null, null, null, null, null, null, null, null, null, null, null);

            result.Should().BeOfType<OkObjectResult>().Which.Value.Should().BeSameAs(page);
            _runner.Verify(r => r.Run(ApiUsageSource.Rest, "search_vulnerabilities", "query=q", It.IsAny<Func<Task<PublicVulnerabilityPage?>>>()), Times.Once);
        }

        [Theory]
        [InlineData(ApiCallStatus.NotFound, 404, "not_found")]
        [InlineData(ApiCallStatus.BadRequest, 400, "bad_request")]
        [InlineData(ApiCallStatus.Disabled, 503, "disabled")]
        [InlineData(ApiCallStatus.Unauthorized, 401, "unauthorized")]
        [InlineData(ApiCallStatus.Error, 500, "internal_error")]
        public async Task Failures_Map_To_Status_Codes_With_A_Json_Error(ApiCallStatus status, int expectedCode, string expectedError)
        {
            RunnerReturns(new ApiCallOutcome<PublicVulnerabilityDetail> { Status = status, Message = "why" });

            var result = (ObjectResult)await Build().GetVulnerability(5);

            result.StatusCode.Should().Be(expectedCode);
            result.Value.Should().BeEquivalentTo(new PublicError { Error = expectedError, Message = "why" });
        }

        [Fact]
        public async Task Rate_Limited_Is_429_With_Retry_After()
        {
            RunnerReturns(new ApiCallOutcome<PublicVulnerabilityDetail> { Status = ApiCallStatus.RateLimited, Message = "slow down", RetryAfterSeconds = 42 });
            var controller = Build();

            var result = (ObjectResult)await controller.GetVulnerability(5);

            result.StatusCode.Should().Be(429);
            controller.Response.Headers.RetryAfter.ToString().Should().Be("42");
        }
    }

    public class PortalMcpToolsTests
    {
        private readonly Mock<IPublicApiService> _service = new();
        private readonly Mock<IApiCallRunner> _runner = new();

        private void RunnerReturns<T>(ApiCallOutcome<T> outcome) where T : class =>
            _runner.Setup(r => r.Run(It.IsAny<ApiUsageSource>(), It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<Func<Task<T?>>>()))
                .ReturnsAsync(outcome);

        private static string Text(CallToolResult result) => ((TextContentBlock)result.Content.Single()).Text;

        [Fact]
        public async Task Success_Is_Camel_Case_Json_With_Readable_Code_Characters()
        {
            RunnerReturns(new ApiCallOutcome<PublicVulnerabilityDetail>
            {
                Status = ApiCallStatus.Ok,
                Value = new PublicVulnerabilityDetail { Id = 5, Title = "a < b && \"c\"", Description = "let x: Vec<u8>;" },
            });

            var result = await new PortalMcpTools(_service.Object, _runner.Object).GetVulnerability(5);

            result.IsError.Should().NotBe(true);
            var text = Text(result);
            text.Should().Contain("\"id\":5").And.Contain("\"description\":\"let x: Vec<u8>;\"").And.Contain("a < b && \\\"c\\\"");
            text.Should().NotContain("sourceUrl"); // nulls are omitted
            _runner.Verify(r => r.Run(ApiUsageSource.Mcp, "get_vulnerability", "id=5", It.IsAny<Func<Task<PublicVulnerabilityDetail?>>>()), Times.Once);
        }

        [Theory]
        [InlineData(ApiCallStatus.NotFound)]
        [InlineData(ApiCallStatus.RateLimited)]
        [InlineData(ApiCallStatus.BadRequest)]
        [InlineData(ApiCallStatus.Error)]
        public async Task Failure_Is_An_Error_Result_With_The_Plain_Message(ApiCallStatus status)
        {
            RunnerReturns(new ApiCallOutcome<PublicVulnerabilityDetail> { Status = status, Message = "Daily limit of 5 calls reached." });

            var result = await new PortalMcpTools(_service.Object, _runner.Object).GetVulnerability(5);

            result.IsError.Should().BeTrue();
            Text(result).Should().Be("Daily limit of 5 calls reached.");
        }

        [Fact]
        public void Tool_Names_Match_The_Usage_Log_Operation_Names_And_All_Are_Read_Only()
        {
            var tools = typeof(PortalMcpTools).GetMethods()
                .Select(m => m.GetCustomAttributes(typeof(ModelContextProtocol.Server.McpServerToolAttribute), false)
                    .Cast<ModelContextProtocol.Server.McpServerToolAttribute>().SingleOrDefault())
                .Where(a => a != null)
                .ToList();

            tools.Select(t => t!.Name).Should().BeEquivalentTo(new[]
            {
                PublicApiOperations.SearchVulnerabilities, PublicApiOperations.GetVulnerability,
                PublicApiOperations.SearchReports, PublicApiOperations.GetReport,
                PublicApiOperations.ListProtocols, PublicApiOperations.ListAuditors, PublicApiOperations.ListCompanies,
            });
            tools.Should().OnlyContain(t => t!.ReadOnly);
        }
    }
}

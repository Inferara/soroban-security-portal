using System.Globalization;
using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;
using SorobanSecurityPortalApi.Common.Security;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Services.PublicApi;

namespace SorobanSecurityPortalApi.Authorization
{
    // Authenticates public API requests with an API key, sent as
    //   Authorization: Bearer ssp_...      or      X-API-Key: ssp_...
    //
    // This scheme is only ever selected for the public surface (see IsPublicApiPath). On the
    // portal's own API an "ssp_" token is just an invalid JWT, so a leaked key - even an
    // admin's - can do nothing but read public data.
    public class ApiKeyAuthenticationHandler : AuthenticationHandler<AuthenticationSchemeOptions>
    {
        public const string SchemeName = ApiKeyClaims.AuthenticationScheme;
        public const string HeaderName = "X-API-Key";

        private readonly IApiKeyProcessor _apiKeys;

        public ApiKeyAuthenticationHandler(
            IOptionsMonitor<AuthenticationSchemeOptions> options,
            ILoggerFactory logger,
            UrlEncoder encoder,
            IApiKeyProcessor apiKeys) : base(options, logger, encoder)
        {
            _apiKeys = apiKeys;
        }

        public static bool IsPublicApiPath(PathString path) =>
            path.StartsWithSegments("/api/mcp") || path.StartsWithSegments("/api/public");

        public static string? ReadKey(HttpRequest request)
        {
            var header = request.Headers[HeaderName].ToString();
            if (!string.IsNullOrWhiteSpace(header)) return header.Trim();

            var authorization = request.Headers.Authorization.ToString();
            const string bearer = "Bearer ";
            if (authorization.StartsWith(bearer, StringComparison.OrdinalIgnoreCase))
                return authorization[bearer.Length..].Trim();
            return null;
        }

        protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
        {
            var key = ReadKey(Request);
            if (string.IsNullOrEmpty(key)) return AuthenticateResult.NoResult();
            if (!ApiKeyGenerator.LooksLikeKey(key)) return AuthenticateResult.Fail("Malformed API key.");

            var model = await _apiKeys.FindUsableByHash(ApiKeyGenerator.Hash(key));
            if (model == null) return AuthenticateResult.Fail("Unknown or revoked API key.");

            var claims = new List<Claim>
            {
                new(ApiKeyClaims.ApiKeyId, model.Id.ToString(CultureInfo.InvariantCulture)),
                new(ApiKeyClaims.LoginId, model.LoginId.ToString(CultureInfo.InvariantCulture)),
            };
            if (model.RateLimitPerMinute is > 0)
                claims.Add(new Claim(ApiKeyClaims.RateLimitPerMinute, model.RateLimitPerMinute.Value.ToString(CultureInfo.InvariantCulture)));
            if (model.RateLimitPerDay is > 0)
                claims.Add(new Claim(ApiKeyClaims.RateLimitPerDay, model.RateLimitPerDay.Value.ToString(CultureInfo.InvariantCulture)));

            // Deliberately no role and no name claims: this identity must not satisfy any of the
            // portal's own authorization checks.
            var identity = new ClaimsIdentity(claims, SchemeName);
            return AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(identity), SchemeName));
        }

        protected override async Task HandleChallengeAsync(AuthenticationProperties properties)
        {
            Response.StatusCode = StatusCodes.Status401Unauthorized;
            Response.Headers.WWWAuthenticate = "Bearer realm=\"Stellar Security Portal API\"";
            await Response.WriteAsJsonAsync(new
            {
                error = "unauthorized",
                message = "A valid API key is required. Create one on your profile page at the Stellar Security Portal "
                          + "and send it as 'Authorization: Bearer <key>'.",
            });
        }
    }
}

using System.Security.Claims;

namespace SorobanSecurityPortalApi.Services.PublicApi
{
    // The API key behind the current public API request.
    public sealed record ApiCaller(int ApiKeyId, int LoginId, int? RateLimitPerMinute, int? RateLimitPerDay);

    public static class ApiKeyClaims
    {
        public const string AuthenticationScheme = "ApiKey";
        public const string ApiKeyId = "ssp:api_key_id";
        public const string LoginId = "ssp:login_id";
        public const string RateLimitPerMinute = "ssp:rate_limit_per_minute";
        public const string RateLimitPerDay = "ssp:rate_limit_per_day";
    }

    public class ApiCallerAccessor : IApiCallerAccessor
    {
        private readonly IHttpContextAccessor _httpContextAccessor;

        public ApiCallerAccessor(IHttpContextAccessor httpContextAccessor)
        {
            _httpContextAccessor = httpContextAccessor;
        }

        // Null when the request was not authenticated with an API key.
        public ApiCaller? GetCaller()
        {
            var user = _httpContextAccessor.HttpContext?.User;
            if (user?.Identity is not { IsAuthenticated: true, AuthenticationType: ApiKeyClaims.AuthenticationScheme })
                return null;
            if (!int.TryParse(user.FindFirstValue(ApiKeyClaims.ApiKeyId), out var keyId)) return null;
            if (!int.TryParse(user.FindFirstValue(ApiKeyClaims.LoginId), out var loginId)) return null;
            return new ApiCaller(
                keyId,
                loginId,
                int.TryParse(user.FindFirstValue(ApiKeyClaims.RateLimitPerMinute), out var perMinute) ? perMinute : null,
                int.TryParse(user.FindFirstValue(ApiKeyClaims.RateLimitPerDay), out var perDay) ? perDay : null);
        }
    }

    public interface IApiCallerAccessor
    {
        ApiCaller? GetCaller();
    }
}

using System.Security.Claims;
using SorobanSecurityPortalApi.Models.DbModels;

namespace SorobanSecurityPortalApi.Services.PublicApi
{
    // The API key behind the current public API request.
    //
    // LoginId is the key's owner (personal key) or the admin who issued it (service key). A service
    // key keeps working when that admin is gone, so it can be null.
    public sealed record ApiCaller(int ApiKeyId, int? LoginId, ApiKeyKind Kind, int? RateLimitPerMinute, int? RateLimitPerDay)
    {
        // Personal keys of one user share a single allowance, so creating or rotating keys never
        // buys more calls. A service key has its own allowance (it carries its own limits).
        public string LimitScope => Kind == ApiKeyKind.Personal ? $"u:{LoginId}" : $"k:{ApiKeyId}";

        // Value written to the usage log (the log column is not nullable).
        public int LoggedLoginId => LoginId ?? 0;
    }

    public static class ApiKeyClaims
    {
        public const string AuthenticationScheme = "ApiKey";
        public const string ApiKeyId = "ssp:api_key_id";
        public const string LoginId = "ssp:login_id";
        public const string Kind = "ssp:kind";
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
            if (!Enum.TryParse<ApiKeyKind>(user.FindFirstValue(ApiKeyClaims.Kind), out var kind)) return null;
            int? loginId = int.TryParse(user.FindFirstValue(ApiKeyClaims.LoginId), out var parsedLogin) ? parsedLogin : null;
            // A personal key is limited per owner; without an owner there is nothing to limit it by.
            if (kind == ApiKeyKind.Personal && loginId == null) return null;
            return new ApiCaller(
                keyId,
                loginId,
                kind,
                int.TryParse(user.FindFirstValue(ApiKeyClaims.RateLimitPerMinute), out var perMinute) ? perMinute : null,
                int.TryParse(user.FindFirstValue(ApiKeyClaims.RateLimitPerDay), out var perDay) ? perDay : null);
        }
    }

    public interface IApiCallerAccessor
    {
        ApiCaller? GetCaller();
    }
}

using Microsoft.AspNetCore.Http;

namespace SorobanSecurityPortalApi.Common
{
    public static class HttpRequestExtensions
    {
        // Behind ingress/nginx the connection IP is the proxy, so the real client is the first
        // X-Forwarded-For hop, falling back to the direct connection IP.
        //
        // NOTE: X-Forwarded-For is client-supplied and therefore spoofable. This value is used ONLY
        // to derive a pseudonymous, best-effort analytics visitor hash — never for auth/authz. Counts
        // are intentionally best-effort; abuse protection is expected at the nginx/ingress layer.
        public static string? GetClientIp(this HttpRequest request)
        {
            var xff = request.Headers["X-Forwarded-For"].ToString();
            if (!string.IsNullOrWhiteSpace(xff))
                return xff.Split(',')[0].Trim();
            return request.HttpContext.Connection.RemoteIpAddress?.ToString();
        }
    }
}

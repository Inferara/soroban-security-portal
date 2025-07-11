using System.IdentityModel.Tokens.Jwt;
using System.Text;
using System.Web;
using SorobanSecurityPortalApi.Common.Extensions;
using Microsoft.Extensions.Caching.Distributed;
using SorobanSecurityPortalApi.Models.ViewModels;

namespace SorobanSecurityPortalApi.Common.SsoSources
{
    public class GoogleSso : IGoogleSso
    {
        private readonly Config _config;
        private readonly ExtendedConfig _extendedConfig;
        private readonly IHttpClientFactory _httpClientFactory;

        public GoogleSso(
            Config config,
            ExtendedConfig extendedConfig,
            IDistributedCache _,
            IHttpClientFactory httpClientFactory)
        {
            _config = config;
            _extendedConfig = extendedConfig;
            _httpClientFactory = httpClientFactory;
        }

        public const string AcrValueConst = "google";
        public static class Parameters
        {
            public const string Domain = "Domain";
            public const string AutoAdmin = "AutoAdmin";
            public const string EmailRegex = "EmailRegex";
        }

        private const string CodeChallenge = "ThisIsntRandomButItNeedsToBe43CharactersLong";

        private string RedirectUrl => $"{_config.AppUrl}/connect/callback";

        private static string Scope => HttpUtility.UrlEncode("openid email profile");

        public async Task<ExtendedTokenModel> GetAccessTokenByCodeAsync(string code)
        {
            var httpClient = GetHttpClient();
            var body = $"client_id={_extendedConfig.GoogleClientId}"
               + $"&scope={Scope}"
               + $"&code={code}"
               + $"&redirect_uri={HttpUtility.UrlEncode(RedirectUrl)}"
               + "&grant_type=authorization_code"
               + $"&code_verifier={CodeChallenge}"
               + (string.IsNullOrEmpty(_extendedConfig.GoogleClientSecret) ? "" : $"&client_secret={_extendedConfig.GoogleClientSecret}");

            var request = new HttpRequestMessage(HttpMethod.Post, "https://oauth2.googleapis.com/token")
            {
                Content = new StringContent(body, Encoding.UTF8, "application/x-www-form-urlencoded")
            };

            using var response = await httpClient.SendAsync(request).ConfigureAwait(false);
            var content = await response.Content.ReadAsStringAsync().ConfigureAwait(false);
            var idToken = content.JsonGet<string>("id_token");
            var refreshToken = content.JsonGet<string>("refresh_token");
            var handler = new JwtSecurityTokenHandler();
            var jsonToken = handler.ReadToken(idToken) as JwtSecurityToken;
            var jwtPayload = jsonToken!.Payload!;

            return new ExtendedTokenModel
            {
                AccessToken = content.JsonGet<string>("access_token")!, // If needed
                RefreshToken = refreshToken,
                Email = jwtPayload["email"]!.ToString()!.ToLower(),
                Name = jwtPayload["name"]!.ToString()!,
                Ip = jwtPayload.ContainsKey("ipaddr") ? jwtPayload["ipaddr"].ToString()! : "",
                Picture = jwtPayload["picture"]?.ToString() ?? "",
            };
        }

        public string GetLogoutRedirectUrl() => "https://accounts.google.com/Logout";

        public string GetLoginRedirectUrl(string state)
        {
            var url = "https://accounts.google.com/o/oauth2/v2/auth?";
            var parameters = $"client_id={_extendedConfig.GoogleClientId}"
                + "&response_type=code"
                + $"&redirect_uri={HttpUtility.UrlEncode(RedirectUrl)}"
                + $"&scope={Scope}"
                + $"&code_challenge_method=plain"
                + $"&code_challenge={CodeChallenge}"
                + $"&state={state}";
            return url + parameters;
        }

        private HttpClient GetHttpClient() => _httpClientFactory.CreateClient(HttpClients.RetryClient);
    }

    public interface IGoogleSso
    {
        Task<ExtendedTokenModel> GetAccessTokenByCodeAsync(string code);
        string GetLogoutRedirectUrl();
        string GetLoginRedirectUrl(string state);
    }
}

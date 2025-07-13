using System.Text;
using System.Web;
using Microsoft.Extensions.Caching.Distributed;
using SorobanSecurityPortalApi.Common.Extensions;
using SorobanSecurityPortalApi.Models.ViewModels;

namespace SorobanSecurityPortalApi.Common.SsoSources
{
    public class DiscordSso : IDiscordSso
    {
        private readonly Config _config;
        private readonly ExtendedConfig _extendedConfig;
        private readonly IHttpClientFactory _httpClientFactory;

        public DiscordSso(
            Config config,
            ExtendedConfig extendedConfig,
            IDistributedCache _,
            IHttpClientFactory httpClientFactory)
        {
            _config = config;
            _extendedConfig = extendedConfig;
            _httpClientFactory = httpClientFactory;
        }

        public const string AcrValueConst = "discord";

        private const string DiscordAuthorizeEndpoint = "https://discord.com/api/oauth2/authorize";
        private const string DiscordTokenEndpoint = "https://discord.com/api/oauth2/token";
        private const string DiscordUserInfoEndpoint = "https://discord.com/api/users/@me";

        private string RedirectUrl => $"{_config.AppUrl}/connect/callback";
        private static string Scope => HttpUtility.UrlEncode("identify email");

        public async Task<ExtendedTokenModel> GetAccessTokenByCodeAsync(string code, string codeVerifier)
        {
            var httpClient = GetHttpClient();
            var body = $"client_id={_extendedConfig.DiscordClientId}"
               + $"&client_secret={_extendedConfig.DiscordClientSecret}"
               + $"&grant_type=authorization_code"
               + $"&code={code}"
               + $"&redirect_uri={HttpUtility.UrlEncode(RedirectUrl)}"
               + $"&code_verifier={codeVerifier}";

            var request = new HttpRequestMessage(HttpMethod.Post, DiscordTokenEndpoint)
            {
                Content = new StringContent(body, Encoding.UTF8, "application/x-www-form-urlencoded")
            };

            using var response = await httpClient.SendAsync(request).ConfigureAwait(false);
            var content = await response.Content.ReadAsStringAsync().ConfigureAwait(false);
            var accessToken = content.JsonGet<string>("access_token");

            // Fetch user info from Discord
            var userRequest = new HttpRequestMessage(HttpMethod.Get, DiscordUserInfoEndpoint);
            userRequest.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);

            using var userResponse = await httpClient.SendAsync(userRequest).ConfigureAwait(false);
            var userContent = await userResponse.Content.ReadAsStringAsync().ConfigureAwait(false);
            var hasAvatar = !string.IsNullOrEmpty(userContent.JsonGet<string>("avatar"));

            return new ExtendedTokenModel
            {
                AccessToken = accessToken,
                RefreshToken = content.JsonGet<string>("refresh_token"),
                Email = userContent.JsonGet<string>("email")?.ToLower() ?? "",
                Name = userContent.JsonGet<string>("username") ?? "",
                Ip = "",
                Picture = hasAvatar
                    ? $"https://cdn.discordapp.com/avatars/{userContent.JsonGet<string>("id")}/{userContent.JsonGet<string>("avatar")}.png"
                    : "/static/images/noavatar.png"
            };
        }

        public string GetLogoutRedirectUrl() => "https://discord.com"; // No true logout endpoint

        public string GetLoginRedirectUrl(string state, string codeChallenge)
        {
            var parameters = $"client_id={_extendedConfig.DiscordClientId}"
                + "&response_type=code"
                + $"&redirect_uri={HttpUtility.UrlEncode(RedirectUrl)}"
                + $"&scope={Scope}"
                + "&code_challenge_method=S256"
                + $"&code_challenge={codeChallenge}"
                + $"&state={state}";

            return $"{DiscordAuthorizeEndpoint}?{parameters}";
        }

        private HttpClient GetHttpClient() => _httpClientFactory.CreateClient(HttpClients.RetryClient);
    }

    public interface IDiscordSso
    {
        Task<ExtendedTokenModel> GetAccessTokenByCodeAsync(string code, string codeVerifier);
        string GetLogoutRedirectUrl();
        string GetLoginRedirectUrl(string state, string codeChallenge);
    }
}

using SorobanSecurityPortalApi.Authorization;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.ViewModels;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Common.Extensions;
using SorobanSecurityPortalApi.Common.SsoSources;

namespace SorobanSecurityPortalApi.Services.ControllersServices
{
    public class ConnectService : IConnectService
    {
        private readonly ILoginProcessor _loginProcessor;
        private readonly ILoginHistoryProcessor _loginHistoryProcessor;
        private readonly ExtendedConfig _config;

        public ConnectService(
            ILoginProcessor loginProcessor,
            ILoginHistoryProcessor loginHistoryProcessor,
            ExtendedConfig config)
        {
            _loginProcessor = loginProcessor;
            _loginHistoryProcessor = loginHistoryProcessor;
            _config = config;
        }

        public async Task<string?> GetCodeByCredentials(string loginName, string password, bool isOfflineMode, string codeChallenge, bool isPermanentToken)
        {
            var login = await _loginProcessor.GetByCredentials(loginName, password);
            if (login == null)
                return null;

            var loginHistory = new LoginHistoryModel
            {
                LoginId = login.LoginId,
                Login = login.Login,
                Code = Guid.NewGuid().ToString(),
                IsOffline = isOfflineMode,
                CodeChallenge = codeChallenge,
                ValidUntilTime = isPermanentToken
                    ? DateTime.UtcNow.AddDays(_config.PermanentTokenExpirationTimeDays)
                    : DateTime.UtcNow.AddMinutes(_config.TokenExpirationTimeMinutes)
            };
            _loginHistoryProcessor.Add(loginHistory);
            return loginHistory.Code;
        }


        public async Task<string> GetCodeBySsoId(ExtendedTokenModel extendedTokenModel, bool isOfflineMode,
            LoginProcessViewModel loginProcessViewModel)
        {
            if (loginProcessViewModel.AcrValues.Contains(DiscordSso.AcrValueConst))
                return await GetDiscordCodeBySsoId(extendedTokenModel, isOfflineMode, loginProcessViewModel);
            if (loginProcessViewModel.AcrValues.Contains(GoogleSso.AcrValueConst))
                return await GetGoogleCodeBySsoId(extendedTokenModel, isOfflineMode, loginProcessViewModel);
            return "Error: Unsupported SSO type";
        }

        public async Task<string> GetDiscordCodeBySsoId(
            ExtendedTokenModel extendedTokenModel,
            bool isOfflineMode,
            LoginProcessViewModel loginProcessViewModel)
        {
            var login = await _loginProcessor.GetByLogin(extendedTokenModel.Email, LoginTypeEnum.SsoDiscord);
            if (login == null)
            {
                login = await _loginProcessor.GetByEmail(extendedTokenModel.Email);
                var userRole = GetRoleFromDiscordGuild(extendedTokenModel);
                if (login != null)
                {
                    var updated = false;
                    if (!login.ConnectedAccounts!.Any(ca => ca.ServiceName == "Discord" && ca.AccountId == extendedTokenModel.Email))
                    {
                        login.ConnectedAccounts!.Add(new ConnectedAccountModel
                        {
                            ServiceName = "Discord",
                            AccountId = extendedTokenModel.Email
                        });
                        updated = true;
                    }
                    if (userRole > login.Role)
                    {
                        login.Role = userRole;
                        updated = true;
                    }
                    if (updated)
                    {
                        await _loginProcessor.Update(login);
                    }
                }
                else
                {
                    login = await _loginProcessor.Add(new LoginModel
                    {
                        Login = extendedTokenModel.Email,
                        Email = extendedTokenModel.Email,
                        FullName = extendedTokenModel.Name,
                        Role = userRole,
                        LoginType = LoginTypeEnum.SsoDiscord,
                        IsEnabled = true,
                        Created = DateTime.UtcNow,
                        CreatedBy = "system",
                        Image = !string.IsNullOrEmpty(extendedTokenModel.Picture)
                            ? await GetImageByUrl(extendedTokenModel.Picture)
                            : null
                    });
                }
            }

            // Sync avatar from SSO on every login, unless user has manually set their avatar
            if (!login.IsAvatarManuallySet && !string.IsNullOrEmpty(extendedTokenModel.Picture))
            {
                var ssoImage = await GetImageByUrl(extendedTokenModel.Picture);
                if (ssoImage.Length > 0)
                {
                    login.Image = ssoImage;
                    await _loginProcessor.Update(login);
                }
            }

            if (!login.IsEnabled)
                return "Error: Login is disabled";

            var loginHistory = new LoginHistoryModel
            {
                LoginId = login.LoginId,
                Login = login.Login,
                Code = Guid.NewGuid().ToString(),
                IsOffline = isOfflineMode,
                CodeChallenge = loginProcessViewModel.CodeChallenge,
                ValidUntilTime = loginProcessViewModel.IsPermanentToken
                    ? DateTime.UtcNow.AddDays(_config.PermanentTokenExpirationTimeDays)
                    : DateTime.UtcNow.AddMinutes(_config.TokenExpirationTimeMinutes),
                Picture = (login.Image != null && login.Image.Length > 0 ? $"/api/v1/user/{login.LoginId}/avatar.png" : ""),
            };
            _loginHistoryProcessor.Add(loginHistory);
            return loginHistory.Code;
        }

        public async Task<string> GetGoogleCodeBySsoId(ExtendedTokenModel extendedTokenModel, bool isOfflineMode, LoginProcessViewModel loginProcessViewModel)
        {
            var login = await _loginProcessor.GetByLogin(extendedTokenModel.Email, LoginTypeEnum.SsoGoogle);
            if (login == null)
            {
                login = await _loginProcessor.GetByEmail(extendedTokenModel.Email);
                if (login != null)
                {
                    if (!login.ConnectedAccounts!.Any(ca => ca.ServiceName == "Google" && ca.AccountId == extendedTokenModel.Email))
                    {
                        login.ConnectedAccounts.Add(new ConnectedAccountModel
                        {
                            ServiceName = "Google",
                            AccountId = extendedTokenModel.Email
                        });
                        await _loginProcessor.Update(login);
                    }
                }
                else
                {
                    login = await _loginProcessor.Add(new LoginModel
                    {
                        Login = extendedTokenModel.Email,
                        Email = extendedTokenModel.Email,
                        FullName = extendedTokenModel.Name,
                        Role = RoleEnum.User,
                        LoginType = LoginTypeEnum.SsoGoogle,
                        IsEnabled = true,
                        Created = DateTime.UtcNow,
                        CreatedBy = "system",
                        Image = !string.IsNullOrEmpty(extendedTokenModel.Picture)
                            ? await GetImageByUrl(extendedTokenModel.Picture)
                            : null
                    });
                }
            }

            // Sync avatar from SSO on every login, unless user has manually set their avatar
            if (!login.IsAvatarManuallySet && !string.IsNullOrEmpty(extendedTokenModel.Picture))
            {
                var ssoImage = await GetImageByUrl(extendedTokenModel.Picture);
                if (ssoImage.Length > 0)
                {
                    login.Image = ssoImage;
                    await _loginProcessor.Update(login);
                }
            }

            if (!login.IsEnabled)
                return "Error: Login is disabled";

            var loginHistory = new LoginHistoryModel
            {
                LoginId = login.LoginId,
                Login = login.Login,
                Code = Guid.NewGuid().ToString(),
                IsOffline = isOfflineMode,
                CodeChallenge = loginProcessViewModel.CodeChallenge,
                ValidUntilTime = loginProcessViewModel.IsPermanentToken
                    ? DateTime.UtcNow.AddDays(_config.PermanentTokenExpirationTimeDays)
                    : DateTime.UtcNow.AddMinutes(_config.TokenExpirationTimeMinutes),
                Picture = (login.Image != null && login.Image.Length > 0 ? $"/api/v1/user/{login.LoginId}/avatar.png" : "")
            };
            _loginHistoryProcessor.Add(loginHistory);
            return loginHistory.Code;
        }

        public async Task<TokenModel?> GetByCode(string code, string codeVerifier)
        {
            var loginHistory = _loginHistoryProcessor.GetByCode(code);
            if (loginHistory == null)
                return null;

            if (loginHistory.CodeChallenge != Pkce.GenerateCodeChallenge(codeVerifier))
                return null;

            return await GetTokenModel(loginHistory);
        }

        public async Task<TokenModel?> GetByRefreshToken(string refreshToken)
        {
            var loginHistory = _loginHistoryProcessor.GetByRefreshToken(refreshToken);
            if (loginHistory == null)
                return null;
            return await GetTokenModel(loginHistory);
        }

        private static string GenerateRefreshToken()
        {
            var randomNumber = new byte[32];
            using var rng = RandomNumberGenerator.Create();
            rng.GetBytes(randomNumber);
            return Convert.ToBase64String(randomNumber);
        }

        private async Task<byte[]> GetImageByUrl(string imageUrl)
        {
            using var httpClient = new HttpClient();
            var response = await httpClient.GetAsync(imageUrl);
            if (response.IsSuccessStatusCode)
            {
                return await response.Content.ReadAsByteArrayAsync();
            }
            return Array.Empty<byte>();
        }

        private async Task<TokenModel> GetTokenModel(LoginHistoryModel loginHistory)
        {
            if (string.IsNullOrEmpty(loginHistory.RefreshToken))
            {
                var newRefreshToken = loginHistory.IsOffline ? GenerateRefreshToken() : null;
                loginHistory.RefreshToken = newRefreshToken;
            }
            loginHistory.Code = null;
            loginHistory.CodeChallenge = null;
            var isPermanentToken = loginHistory.ValidUntilTime > DateTime.UtcNow.AddMinutes(_config.TokenExpirationTimeMinutes);
            loginHistory.ValidUntilTime = isPermanentToken
                ? DateTime.UtcNow.AddDays(_config.PermanentTokenExpirationTimeDays)
                : DateTime.UtcNow.AddMinutes(_config.TokenExpirationTimeMinutes);
            _loginHistoryProcessor.Update(loginHistory);

            var login = await _loginProcessor.GetById(loginHistory.LoginId);

            var now = DateTime.UtcNow;
            var accessToken = CreateAccessToken(login, loginHistory, now);
            var idToken = CreateIdToken(login, now, loginHistory, accessToken);

            return new TokenModel
            {
                AccessToken = accessToken,
                RefreshToken = loginHistory.RefreshToken,
                ExpiresIn = _config.TokenExpirationTimeMinutes * 60,
                TokenType = "Bearer",
                Scope = "openid" + (loginHistory.IsOffline ? " offline_access" : string.Empty),
                IdToken = idToken
            };
        }

        private string CreateAccessToken(LoginModel login, LoginHistoryModel loginHistory, DateTime now)
        {
            var accessTokenClaims = new List<Claim>
            {
                new(AccessTokenClaims.FullName, login.FullName),
                new(AccessTokenClaims.Role, login.Role.ToString()),
                new(AccessTokenClaims.LoginType, login.LoginType.ToString()),
                new(AccessTokenClaims.Sub, login.Login),
                new(AccessTokenClaims.Picture, loginHistory.Picture),

            };
            var jwtAccessToken = new JwtSecurityToken(
                issuer: _config.AuthIssuer,
                audience: _config.AuthAudience,
                claims: accessTokenClaims,
                notBefore: now,
                expires: now.Add(TimeSpan.FromMinutes(_config.TokenExpirationTimeMinutes)),
                signingCredentials: new SigningCredentials(_config.AuthSecurityKey.GetSymmetricSecurityKey(), SecurityAlgorithms.HmacSha256));

            var accessToken = new JwtSecurityTokenHandler().WriteToken(jwtAccessToken);
            return accessToken;
        }

        public async Task<LoginModel?> CheckAccessToken(string accessToken)
        {
            var tokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidIssuer = _config.AuthIssuer,
                ValidateAudience = true,
                ValidAudience = _config.AuthAudience,
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = _config.AuthSecurityKey.GetSymmetricSecurityKey(),
                ValidateLifetime = true,
                ClockSkew = TimeSpan.Zero
            };         
            var tokenHandler = new JwtSecurityTokenHandler();
            var principal = await tokenHandler.ValidateTokenAsync(accessToken, tokenValidationParameters);
            if (!principal.IsValid)
                return null;

            var loginName = ((JwtSecurityToken)principal.SecurityToken).Subject;
            var loginTypeString = principal.Claims[AccessTokenClaims.LoginType].ToString();
            if (loginName == null || loginTypeString == null || !Enum.TryParse(loginTypeString, out LoginTypeEnum loginType))
                return null;
            var login = await _loginProcessor.GetByLogin(loginName, loginType);

            return login;
        }

        private string CreateIdToken(LoginModel login, DateTime now, LoginHistoryModel loginHistory, string accessToken)
        {
            var authTime = new DateTimeOffset(loginHistory.Created).ToUnixTimeSeconds();
            var idTokenClaims = new List<Claim>
            {
                new(IdTokenClaims.AtHash, accessToken.Sha256()),
                new(IdTokenClaims.SessionId, loginHistory.LoginHistoryId.ToString()),
                new(IdTokenClaims.AuthTime, authTime.ToString(), ClaimValueTypes.Integer),
                new(IdTokenClaims.Iat, authTime.ToString(), ClaimValueTypes.Integer),
                new(IdTokenClaims.Role, login.Role.ToString()),
                new(IdTokenClaims.LoginType, login.LoginType.ToString()),
                new(IdTokenClaims.Sub, login.Login),
                new(IdTokenClaims.FullName, login.FullName),
                new(IdTokenClaims.Picture, loginHistory.Picture),
                new(IdTokenClaims.Id, login.LoginId.ToString()),
            };
            var idTokenAccessToken = new JwtSecurityToken(
                issuer: _config.AuthIssuer,
                audience: _config.AuthAudience,
                claims: idTokenClaims,
                notBefore: now,
                expires: now.Add(TimeSpan.FromMinutes(_config.TokenExpirationTimeMinutes)),
                signingCredentials: new SigningCredentials(_config.AuthSecurityKey.GetSymmetricSecurityKey(), SecurityAlgorithms.HmacSha256));

            var idToken = new JwtSecurityTokenHandler().WriteToken(idTokenAccessToken);
            return idToken;
        }

        private RoleEnum GetRoleFromDiscordGuild(ExtendedTokenModel extendedTokenModel)
        {
            if (extendedTokenModel.GuildMemberInfo == null)
            {
                return RoleEnum.User;
            }
            if (extendedTokenModel.GuildMemberInfo.IsPathfinder())
            {
                return RoleEnum.User;
            }
            else if (extendedTokenModel.GuildMemberInfo.IsNavigator())
            {
                return RoleEnum.Contributor;
            }
            else if (extendedTokenModel.GuildMemberInfo.IsPilot())
            {
                return RoleEnum.Moderator;
            }
            return RoleEnum.User;
        }

        public void Logout(string idToken)
        {
            var jsonToken = new JwtSecurityTokenHandler().ReadToken(idToken) as JwtSecurityToken;
            var sessionId = Convert.ToInt32(jsonToken?.Payload[IdTokenClaims.SessionId].ToString());
            var loginHistory = _loginHistoryProcessor.GetBySessionId(sessionId);
            if (loginHistory == null)
                return;
            loginHistory.ValidUntilTime = DateTime.UtcNow;
            _loginHistoryProcessor.Update(loginHistory);
        }
    }

    public interface IConnectService
    {
        Task<string?> GetCodeByCredentials(string loginName, string password, bool isOfflineMode, string codeChallenge, bool isPermanentToken);
        Task<string> GetCodeBySsoId(ExtendedTokenModel extendedTokenModel, bool isOfflineMode, LoginProcessViewModel loginProcessViewModel);
        Task<TokenModel?> GetByCode(string code, string codeVerifier);
        Task<TokenModel?> GetByRefreshToken(string refreshToken);
        Task<LoginModel?> CheckAccessToken(string accessToken);
        void Logout(string idToken);
    }
}

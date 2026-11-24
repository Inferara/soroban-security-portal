using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Common.Extensions;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;
using AutoMapper;
using SorobanSecurityPortalApi.Services.PublicApi;

namespace SorobanSecurityPortalApi.Services.ControllersServices
{
    public class UserService : IUserService
    {
        private readonly IMapper _mapper;
        private readonly ILoginProcessor _loginProcessor;
        private readonly ExtendedConfig _extendedConfig;
        private readonly ApiKeyLookupCache _apiKeyCache;

        public UserService(
            IMapper mapper,
            ILoginProcessor loginProcessor,
            ExtendedConfig extendedConfig,
            ApiKeyLookupCache apiKeyCache)
        {
            _mapper = mapper;
            _loginProcessor = loginProcessor;
            _extendedConfig = extendedConfig;
            _apiKeyCache = apiKeyCache;
        }

        public async Task<LoginSummaryViewModel> GetLoginById(int loginId)
        {
            var login = await _loginProcessor.GetById(loginId);
            var loginsViewModel = _mapper.Map<LoginSummaryViewModel>(login);
            return loginsViewModel;
        }

        public async Task EnabledChange(int loginId, bool isEnabled)
        {
            var login = await _loginProcessor.GetById(loginId);
            if (login != null)
            {
                login.IsEnabled = isEnabled;
                await _loginProcessor.Update(login);
                // The user's API keys stop working at once, not when their cache entries expire.
                if (!isEnabled) _apiKeyCache.Clear();
            }
        }

        public async Task<LoginSummaryViewModel?> Add(LoginSummaryViewModel loginSummaryViewModel)
        {
            if (string.IsNullOrEmpty(loginSummaryViewModel.Login))
                return null;
            var existingLogin = await _loginProcessor.GetByLogin(loginSummaryViewModel.Login, LoginTypeEnum.Password);
            if(existingLogin != null)
                return null;

            var loginModel = _mapper.Map<LoginModel>(loginSummaryViewModel);
            loginModel = await _loginProcessor.Add(loginModel);
            loginSummaryViewModel = _mapper.Map<LoginSummaryViewModel>(loginModel);
            return loginSummaryViewModel;
        }

        public async Task<bool> Update(int loginId, LoginViewModel editLoginViewModel)
        {
            var login = await _loginProcessor.GetById(loginId);
            if (login == null)
                return false;
            var loginModel = _mapper.Map<LoginModel>(editLoginViewModel);
            login.FullName = loginModel.FullName;
            login.Role = loginModel.Role;
            login.Email = loginModel.Email;
            login.PersonalInfo = loginModel.PersonalInfo;
            login.Image = loginModel.Image;
            login.ConnectedAccounts = loginModel.ConnectedAccounts;
            await _loginProcessor.Update(login);
            return true;
        }

        private static readonly System.Text.RegularExpressions.Regex GitHubUrlRegex = new(
            @"^https://(www\.)?github\.com/[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?/?$",
            System.Text.RegularExpressions.RegexOptions.Compiled | System.Text.RegularExpressions.RegexOptions.IgnoreCase);

        private static readonly System.Text.RegularExpressions.Regex XUrlRegex = new(
            @"^https://(www\.)?(x\.com|twitter\.com)/[a-zA-Z0-9_]{1,15}/?$",
            System.Text.RegularExpressions.RegexOptions.Compiled | System.Text.RegularExpressions.RegexOptions.IgnoreCase);

        public async Task<bool> SelfUpdate(int loginId, LoginSelfUpdateViewModel userUpdateSelfViewModel)
        {
            var login = await _loginProcessor.GetById(loginId);
            if (login == null)
                return false;

            // Detect if user is changing their avatar (either uploading new or removing)
            bool imageChanged = !AreImagesEqual(login.Image, userUpdateSelfViewModel.Image);

            // Validate and extract only client-managed social accounts (GitHub, X).
            // SSO accounts (Google, Discord, etc.) are strictly DB-authoritative and
            // any submitted values for them are ignored to prevent spoofing or stale data overwrite.
            var validatedSocialAccounts = new List<ConnectedAccountModel>();
            if (userUpdateSelfViewModel.ConnectedAccounts != null)
            {
                foreach (var ca in userUpdateSelfViewModel.ConnectedAccounts)
                {
                    if (string.Equals(ca.ServiceName, "GitHub", StringComparison.OrdinalIgnoreCase))
                    {
                        var url = ca.AccountId?.Trim() ?? string.Empty;
                        if (!string.IsNullOrEmpty(url))
                        {
                            if (!GitHubUrlRegex.IsMatch(url))
                                return false;

                            validatedSocialAccounts.Add(new ConnectedAccountModel
                            {
                                ServiceName = "GitHub",
                                AccountId = url
                            });
                        }
                    }
                    else if (string.Equals(ca.ServiceName, "X", StringComparison.OrdinalIgnoreCase))
                    {
                        var url = ca.AccountId?.Trim() ?? string.Empty;
                        if (!string.IsNullOrEmpty(url))
                        {
                            if (!XUrlRegex.IsMatch(url))
                                return false;

                            validatedSocialAccounts.Add(new ConnectedAccountModel
                            {
                                ServiceName = "X",
                                AccountId = url
                            });
                        }
                    }
                }
            }

            return await _loginProcessor.UpdateSelfProfile(
                loginId,
                userUpdateSelfViewModel.FullName,
                userUpdateSelfViewModel.PersonalInfo,
                userUpdateSelfViewModel.Image,
                imageChanged,
                validatedSocialAccounts);
        }

        private static bool AreImagesEqual(byte[]? a, byte[]? b)
        {
            if (a == null && b == null) return true;
            if (a == null || b == null) return false;
            if (a.Length != b.Length) return false;
            return a.AsSpan().SequenceEqual(b.AsSpan());
        }

        public async Task<bool?> Delete(int loginId)
        {
            var login = await _loginProcessor.GetById(loginId);
            if (login == null)
                return null;
            await _loginProcessor.Delete(loginId);
            _apiKeyCache.Clear();
            return true;
        }

        public async Task<bool> ChangePassword(string login, ChangePasswordViewModel changePasswordViewModel)
        {
            var loginModel = await _loginProcessor.GetByLogin(login, LoginTypeEnum.Password);
            if (loginModel == null || loginModel.PasswordHash != changePasswordViewModel.OldPassword.GetHash())
                return false;

            loginModel.PasswordHash = changePasswordViewModel.NewPassword.GetHash();
            await _loginProcessor.Update(loginModel);
            return true;
        }

        public async Task<List<LoginSummaryViewModel>> List()
        {
            var logins = await _loginProcessor.List();
            var loginsViewModel = _mapper.Map<List<LoginSummaryViewModel>>(logins);
            return loginsViewModel;
        }

        public async Task<List<UserSearchResultViewModel>> SearchUsers(string q)
        {
            var rows = await _loginProcessor.SearchUsers(q, 5);
            return rows.Select(l => new UserSearchResultViewModel
            {
                Id = l.LoginId,
                Username = l.Login,
                DisplayName = string.IsNullOrWhiteSpace(l.FullName) ? l.Login : l.FullName
            }).ToList();
        }
    }

    public interface IUserService
    {
        Task<LoginSummaryViewModel> GetLoginById(int loginId);
        Task EnabledChange(int loginId, bool isEnabled);
        Task<LoginSummaryViewModel?> Add(LoginSummaryViewModel loginSummaryViewModel);
        Task<bool> Update(int loginId, LoginViewModel editLoginViewModel);
        Task<bool> SelfUpdate(int loginId, LoginSelfUpdateViewModel editLoginViewModel);
        Task<bool?> Delete(int loginId);
        Task<bool> ChangePassword(string login, ChangePasswordViewModel changePasswordViewModel);
        Task<List<LoginSummaryViewModel>> List();
        Task<List<UserSearchResultViewModel>> SearchUsers(string q);
    }
}

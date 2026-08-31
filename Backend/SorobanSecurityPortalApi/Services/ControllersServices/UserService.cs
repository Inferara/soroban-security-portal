using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Common.Extensions;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;
using AutoMapper;

namespace SorobanSecurityPortalApi.Services.ControllersServices
{
    public class UserService : IUserService
    {
        private readonly IMapper _mapper;
        private readonly ILoginProcessor _loginProcessor;
        private readonly ExtendedConfig _extendedConfig;

        public UserService(
            IMapper mapper,
            ILoginProcessor loginProcessor,
            ExtendedConfig extendedConfig)
        {
            _mapper = mapper;
            _loginProcessor = loginProcessor;
            _extendedConfig = extendedConfig;
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

        public async Task<bool> SelfUpdate(int loginId, LoginSelfUpdateViewModel userUpdateSelfViewModel)
        {
            var login = await _loginProcessor.GetById(loginId);
            if (login == null)
                return false;

            var loginModel = _mapper.Map<LoginModel>(userUpdateSelfViewModel);
            login.FullName = loginModel.FullName;
            login.PersonalInfo = loginModel.PersonalInfo;

            // Only client-managed social links (GitHub, X) are taken from the
            // submission.  SSO accounts (Google, Discord, etc.) are NEVER trusted
            // from the client — they are managed exclusively by the OAuth flow.
            var clientManagedServices = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                "GitHub", "X"
            };

            // Collect the client-managed accounts the user wants to set
            var submittedAccounts = loginModel.ConnectedAccounts ?? new List<ConnectedAccountModel>();
            var clientSubmitted = submittedAccounts
                .Where(ca => clientManagedServices.Contains(ca.ServiceName))
                .ToList();

            // Detect if user is changing their avatar (either uploading new or removing)
            // Set IsAvatarManuallySet=true to prevent SSO from overwriting
            bool imageChanged = !AreImagesEqual(login.Image, loginModel.Image);
            if (imageChanged)
            {
                login.Image = loginModel.Image;
                login.IsAvatarManuallySet = true;
            }

            // Re-read the login entity from the DB immediately before saving so we
            // merge onto the freshest SSO state.  This closes the window where a
            // concurrent OAuth callback could add or modify an SSO connection and
            // have it silently overwritten by our update.
            var freshLogin = await _loginProcessor.GetById(loginId);
            if (freshLogin == null)
                return false;

            // Carry forward the fields SelfUpdate is allowed to change.
            // ConnectedAccounts: keep fresh SSO state; replace only GitHub/X from
            // the submission.
            freshLogin.FullName = login.FullName;
            freshLogin.PersonalInfo = login.PersonalInfo;

            // Only copy Image/IsAvatarManuallySet when the user actually changed
            // the avatar.  Otherwise let the fresh read keep its values so we don't
            // silently overwrite a concurrent SSO avatar sync.
            if (imageChanged)
            {
                freshLogin.Image = login.Image;
                freshLogin.IsAvatarManuallySet = true;
            }

            var merged = freshLogin.ConnectedAccounts?
                .Where(ca => !clientManagedServices.Contains(ca.ServiceName))
                .ToList() ?? new List<ConnectedAccountModel>();

            merged.AddRange(clientSubmitted);
            freshLogin.ConnectedAccounts = merged;

            await _loginProcessor.Update(freshLogin);
            return true;
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

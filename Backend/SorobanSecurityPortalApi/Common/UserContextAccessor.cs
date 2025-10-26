using SorobanSecurityPortalApi.Authorization;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.DbModels;
using System.Security.Claims;

namespace SorobanSecurityPortalApi.Common
{
    public class UserContextAccessor
    {
        private readonly IHttpContextAccessor _httpContextAccessor;

        private readonly ILoginProcessor _loginProcessor;

        public static AsyncLocal<int?> AsyncScheduledLoginId = new();
        private int? _loginId;
        private string? _loginName;

        public UserContextAccessor(IHttpContextAccessor httpContextAccessor, ILoginProcessor loginProcessor)
        {
            _httpContextAccessor = httpContextAccessor;
            _loginProcessor = loginProcessor;
        }

        public async Task<int> GetLoginIdAsync()
        {
            if (!_loginId.HasValue)
            {
                await LoadUserData();
            }
            return _loginId!.Value;
        }

        public async Task<string> GetLoginNameAsync()
        {
            if (string.IsNullOrEmpty(_loginName))
            {
                await LoadUserData();
            }
            return _loginName ?? "Unknown";
        }

        private readonly Dictionary<string, bool> _roles = new();
        public bool HasRole(string role)
        {
            if (!_roles.ContainsKey(role))
                _roles[role] = _httpContextAccessor?.HttpContext?.User.FindFirstValue(ClaimTypes.Role) == role;
            return _roles[role];
        }

        private async Task LoadUserData()
        {
            if (_httpContextAccessor.HttpContext == null)
                return;
            if (_httpContextAccessor.HttpContext.User.Identity is not ClaimsIdentity identity)
                return;
            var claims = identity.Claims.ToDictionary(key => key.Type, value => value.Value);
            claims.TryGetValue(ClaimTypes.NameIdentifier, out var login);
            _loginName = login;

            var loginType = claims.TryGetValue(IdTokenClaims.LoginType, out var loginTypeClaimValue)
                ? Enum.Parse<LoginTypeEnum>(loginTypeClaimValue)
                : LoginTypeEnum.Password;
            if (login == null)
                return;
            var userData = await _loginProcessor.GetByLogin(login, loginType);
            if (userData == null)
                return;
            _loginId = userData.LoginId;
        }

        public async Task<bool> IsLoginAdmin(string login)
        {
            var loginModel = await _loginProcessor.GetByLogin(login);
            if (loginModel == null)
                return false;
            return loginModel.Role == RoleEnum.Admin;
        }

        public async Task<bool> IsLoginIdAdmin(int loginId)
        {
            var loginModel = await _loginProcessor.GetById(loginId);
            if (loginModel == null)
                return false;
            return loginModel.Role == RoleEnum.Admin;
        }
    }
}

namespace SorobanSecurityPortalApi.Models.ViewModels
{
    public class LoginViewModel
    {
        public int LoginId { get; set; }
        public string Login { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public string? LoginType { get; set; } = string.Empty;
        public DateTime Created { get; set; } = DateTime.UtcNow;
        public string CreatedBy { get; set; } = string.Empty;
        public string? PersonalInfo { get; set; } = string.Empty;
        public byte[]? Image { get; set; }
        public List<ConnectedAccountViewModel>? ConnectedAccounts { get; set; } = new();
    }

    public class ConnectedAccountViewModel
    {
        public string ServiceName { get; set; } = "";
        public string AccountId { get; set; } = "";
    }

    public class LoginSelfUpdateViewModel
    {
        public string FullName { get; set; } = string.Empty;
        public string? PersonalInfo { get; set; } = string.Empty;
        public byte[]? Image { get; set; }
        /// <summary>
        /// When true, indicates user wants to set/remove avatar manually.
        /// This prevents SSO from overwriting the avatar on next login.
        /// </summary>
        public bool? IsAvatarManuallySet { get; set; }
        public List<ConnectedAccountViewModel>? ConnectedAccounts { get; set; } = new();
    }
}

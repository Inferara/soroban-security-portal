using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SorobanSecurityPortalApi.Models.DbModels
{
    [Table("login")]
    public class LoginModel
    {
        [Key] public int LoginId { get; set; }
        public string FullName { get; set; } = string.Empty;
        public string Login { get; set; } = string.Empty;
        public string PasswordHash { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public bool IsEnabled { get; set; }
        public RoleEnum Role { get; set; }
        public LoginTypeEnum LoginType { get; set; } = LoginTypeEnum.Password;
        public DateTime Created { get; set; } = DateTime.UtcNow;
        public string CreatedBy { get; set; } = string.Empty;
        public string? PersonalInfo { get; set; } = string.Empty;
        public byte[]? Image { get; set; }
        /// <summary>
        /// When true, SSO login will NOT sync the avatar from the social account.
        /// This is set to true when user manually uploads or removes their avatar.
        /// </summary>
        public bool IsAvatarManuallySet { get; set; }
        [Column(TypeName = "jsonb")]
        public List<ConnectedAccountModel>? ConnectedAccounts { get; set; } = [];
    }

    public class ConnectedAccountModel
    {
        public string ServiceName { get; set; } = "";
        public string AccountId { get; set; } = "";
    }

    public enum RoleEnum
    {
        User = 100,
        Contributor = 200,
        Moderator = 300,
        Admin = 1000,
    }

    public enum LoginTypeEnum
    {
        Password = 1,
        SsoGoogle = 2,
        SsoDiscord = 3
    }

    public enum ConnectedAccountTypeEnum
    {
        Google = 1,
        Discord = 2,
        GitHub = 3,
        Twitter = 4
    }
}
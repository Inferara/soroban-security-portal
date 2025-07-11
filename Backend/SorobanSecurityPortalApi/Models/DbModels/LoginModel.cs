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
        public int TokensLimit { get; set; } = 0;
    }

    public class LoginWithSpentModel: LoginModel
    {
        public LoginWithSpentModel(LoginModel loginModel)
        {
            LoginId = loginModel.LoginId;
            FullName = loginModel.FullName;
            Login = loginModel.Login;
            PasswordHash = loginModel.PasswordHash;
            Email = loginModel.Email;
            IsEnabled = loginModel.IsEnabled;
            Role = loginModel.Role;
            LoginType = loginModel.LoginType;
            Created = loginModel.Created;
            CreatedBy = loginModel.CreatedBy;
            TokensLimit = loginModel.TokensLimit;
        }
        public int? TokensSpent { get; set; } = 0;
    }

    public enum RoleEnum
    {
        User = 1,
        Admin = 2,
        Contributor = 3,
        Moderator = 4
    }

    public enum LoginTypeEnum
    {
        Password = 1,
        SsoGoogle = 2
    }
}
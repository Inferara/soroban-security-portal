using SorobanSecurityPortalApi.Models.DbModels;
using Newtonsoft.Json;

namespace SorobanSecurityPortalApi.Models.ViewModels;

public class LoginSummaryViewModel
{
    public int LoginId { get; set; }
    public string? Login { get; set; }
    [JsonProperty(NullValueHandling = NullValueHandling.Ignore)]
    public string? Password { get; set; }
    public string? FullName { get; set; }
    public string? Email { get; set; }
    public string? Role { get; set; } = nameof(RoleEnum.User);
    public bool IsEnabled { get; set; }
    public string? LoginType { get; set; } = nameof(LoginTypeEnum.Password);
    public DateTime Created { get; set; } = DateTime.UtcNow;
    public string CreatedBy { get; set; } = string.Empty;
    public string? PersonalInfo { get; set; } = string.Empty;
    public byte[]? Image { get; set; }
    public List<ConnectedAccountViewModel>? ConnectedAccounts { get; set; } = new();
}


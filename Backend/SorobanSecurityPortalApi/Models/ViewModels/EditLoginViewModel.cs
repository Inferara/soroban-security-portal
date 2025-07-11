namespace SorobanSecurityPortalApi.Models.ViewModels;

public class EditLoginViewModel
{
    public string? FullName { get; set; }
    public string? Email { get; set; }
    public string? Role { get; set; }
    public bool IsEnabled { get; set; }
}
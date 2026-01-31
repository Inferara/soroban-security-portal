namespace SorobanSecurityPortalApi.Models.ViewModels;

public class UserSearchResultViewModel
{
    public int LoginId { get; set; }
    public string? Login { get; set; }
    public string? FullName { get; set; }
    public byte[]? Image { get; set; }
}
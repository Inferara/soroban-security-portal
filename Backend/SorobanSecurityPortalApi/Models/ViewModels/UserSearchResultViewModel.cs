namespace SorobanSecurityPortalApi.Models.ViewModels
{
    // Minimal public user info for @mention autocomplete — no PII beyond display name + username.
    public class UserSearchResultViewModel
    {
        public int Id { get; set; }
        public string DisplayName { get; set; } = string.Empty;
        public string Username { get; set; } = string.Empty;
    }
}

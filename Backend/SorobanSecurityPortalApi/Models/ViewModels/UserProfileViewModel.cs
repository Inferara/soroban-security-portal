namespace SorobanSecurityPortalApi.Models.ViewModels
{
    public class UserProfileViewModel
    {
        public int Id { get; set; }
        public int LoginId { get; set; }
        public string? FullName { get; set; }
        public string? Email { get; set; }
        public string? Bio { get; set; }
        public string? Location { get; set; }
        public string? Website { get; set; }
        public string? TwitterHandle { get; set; }
        public string? GithubHandle { get; set; }
        public List<string> ExpertiseTags { get; set; } = new List<string>();
        public int ReputationScore { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }

    public class UpdateUserProfileViewModel
    {
        public string? Bio { get; set; }
        public string? Location { get; set; }
        public string? Website { get; set; }
        public string? TwitterHandle { get; set; }
        public string? GithubHandle { get; set; }
        public List<string>? ExpertiseTags { get; set; }
    }
}
namespace SorobanSecurityPortalApi.Models.ViewModels
{
    public class PublicUserProfileViewModel
    {
        public int LoginId { get; set; }
        public string? Bio { get; set; }
        public string? Location { get; set; }
        public string? Website { get; set; }
        public List<string> ExpertiseTags { get; set; } = new List<string>();
        public int ReputationScore { get; set; }
    }
}

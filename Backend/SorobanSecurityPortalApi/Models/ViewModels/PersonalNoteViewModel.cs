namespace SorobanSecurityPortalApi.Models.ViewModels
{
    public class PersonalNoteViewModel
    {
        public int Id { get; set; }
        public int VulnerabilityId { get; set; }
        public string Content { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        // False when the vulnerability has been hidden or deleted; Title/Description/Severity are then empty.
        public bool IsVulnerabilityAvailable { get; set; } = true;
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Severity { get; set; } = string.Empty;
    }

    public class UpsertPersonalNoteRequest
    {
        public string Content { get; set; } = string.Empty;
    }
}

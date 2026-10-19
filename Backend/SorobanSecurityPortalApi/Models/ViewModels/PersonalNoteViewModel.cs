namespace SorobanSecurityPortalApi.Models.ViewModels
{
    public class PersonalNoteViewModel
    {
        public int Id { get; set; }
        public int VulnerabilityId { get; set; }
        public string Content { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Severity { get; set; } = string.Empty;
    }

    public class UpsertPersonalNoteRequest
    {
        public string Content { get; set; } = string.Empty;
    }
}

namespace SorobanSecurityPortalApi.Models.ViewModels
{
    public class BadgeViewModel
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Icon { get; set; } = string.Empty; 
        public string Category { get; set; } = string.Empty; 
        public string Criteria { get; set; } = string.Empty;
    }
}
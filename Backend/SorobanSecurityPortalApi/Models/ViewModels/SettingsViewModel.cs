namespace SorobanSecurityPortalApi.Models.ViewModels
{
    public class SettingsViewModel
    {
        public string SettingId { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Value { get; set; } = string.Empty;
        public string DateType { get; set; } = string.Empty;
        public string Tooltip { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public string[]? Options { get; set; }
    }
}

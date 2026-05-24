namespace SorobanSecurityPortalApi.Models.ViewModels
{
    public class ContentFilterResult
    {
        public bool IsBlocked { get; set; }
        public bool RequiresModeration { get; set; }
        public string SanitizedContent { get; set; } = string.Empty;
        public List<string> Warnings { get; set; } = new();
    }
}

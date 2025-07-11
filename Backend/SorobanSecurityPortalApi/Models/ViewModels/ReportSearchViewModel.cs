namespace SorobanSecurityPortalApi.Models.ViewModels
{
    public class ReportSearchViewModel
    {
        public string? SearchText { get; set; }
        public DateTime? From { get; set; }
        public DateTime? To { get; set; }
        public string? SortBy { get; set; }
        public string? SortDirection { get; set; }
    }
}

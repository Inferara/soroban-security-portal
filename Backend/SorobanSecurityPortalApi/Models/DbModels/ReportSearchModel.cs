namespace SorobanSecurityPortalApi.Models.DbModels
{
    public class ReportSearchModel
    {
        public string? SearchText { get; set; }
        public DateTime? From { get; set; }
        public DateTime? To { get; set; }
        public string? SortBy { get; set; }
        public string? SortDirection { get; set; }
        public string? Company { get; set; } = null;
        public string? Protocol { get; set; } = null;
        public string? Auditor { get; set; } = null;

    }
}
namespace SorobanSecurityPortalApi.Models.DbModels
{
    public class ReportSearchModel
    {
        public string? SearchText { get; set; }
        public DateTime? From { get; set; }
        public DateTime? To { get; set; }
        public string? SortBy { get; set; }
        public string? SortDirection { get; set; }
    }
}
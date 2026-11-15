using Pgvector;

namespace SorobanSecurityPortalApi.Models.DbModels
{
    public class ReportSearchModel
    {
        public string? SearchText { get; set; }
        public DateTime? From { get; set; }
        public DateTime? To { get; set; }
        public string? SortBy { get; set; }
        public string? SortDirection { get; set; }
        public int? CompanyId { get; set; } = null;
        public string? CompanyName { get; set; } = null;
        public int? ProtocolId { get; set; } = null;
        public string? ProtocolName { get; set; } = null;
        public int? AuditorId { get; set; } = null;
        public string? AuditorName { get; set; } = null;
        public Vector? Embedding { get; set; } = null;
        // Overrides the configured minimum relevance for this search. The configured value is tuned
        // for text + vector scores together; a text-only search (no embedding available) needs a
        // lower bar or it finds nothing.
        public double? MinRelevance { get; set; }

    }
}
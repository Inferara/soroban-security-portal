namespace SorobanSecurityPortalApi.Models.ViewModels
{
    public class SearchItemModel
    {
        public string Sender { get; set; } = string.Empty;
        public string Text { get; set; } = string.Empty;
        public string Link { get; set; } = string.Empty;
        public DateTime CreateTime { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedTime { get; set; } = DateTime.UtcNow;
        public string SourceContentType { get; set; } = string.Empty;
        public string SourceName { get; set; } = string.Empty;
        public List<SearchItemPartitionTextModel> Texts { get; set; } = new();
    }

    public class SearchItemPartitionTextModel
    {
        public string Text { get; set; } = string.Empty;
        public double Relevance { get; set; }
        public int PartNumber { get; set; }
    }
}

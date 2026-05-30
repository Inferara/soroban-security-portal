namespace SorobanSecurityPortalApi.Models.ViewModels
{
    public class RecompressImagesResultViewModel
    {
        public int Processed { get; set; }
        public int Skipped { get; set; }
        public int Failed { get; set; }
        public long BytesBefore { get; set; }
        public long BytesAfter { get; set; }
        public List<int> FailedIds { get; set; } = new();
    }
}

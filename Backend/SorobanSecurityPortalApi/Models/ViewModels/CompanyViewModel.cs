namespace SorobanSecurityPortalApi.Models.ViewModels
{
    public class CompanyViewModel
    {
        public int Id { get; set; }
        public string Name { get; set; } = "";
        public string Description { get; set; } = "";
        public byte[]? ImageData { get; set; }
        public string Url { get; set; } = "";
        public DateTime Date { get; set; }
        public int CreatedBy { get; set; }
    }
}

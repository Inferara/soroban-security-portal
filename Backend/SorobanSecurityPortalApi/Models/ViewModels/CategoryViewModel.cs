namespace SorobanSecurityPortalApi.Models.ViewModels
{
    public class CategoryViewModel
    {
        public int Id { get; set; }
        public string Name { get; set; } = "";
        public string BgColor { get; set; } = "";
        public string TextColor { get; set; } = "";
        public DateTime Date { get; set; }
        public int CreatedBy { get; set; }
    }
}

namespace SorobanSecurityPortalApi.Models.ViewModels
{
    public class AuditorViewModel
    {
        public int Id { get; set; }
        public string Name { get; set; } = "";
        public string Url { get; set; } = "";
        public DateTime Date { get; set; }
        public string CreatedBy { get; set; } = "";
    }
}

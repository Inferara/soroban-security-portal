namespace SorobanSecurityPortalApi.Models.ViewModels
{
    public class ReportViewModel
    {
        public int Id { get; set; }
        public string Name { get; set; } = "";
        public byte[]? Image { get; set; } = null;
        public byte[]? BinFile { get; set; } = null;
        public string MdFile { get; set; } = "";
        public DateTime Date { get; set; }
        public string Status { get; set; } = "";
        public string Author { get; set; } = "";
        public string LastActionBy { get; set; } = "";
        public DateTime LastActionAt { get; set; }
    }

    public class AddReportViewModel
    {
        public int Id { get; set; } = 0;
        public string Title { get; set; } = "";
        public string Url { get; set; } = "";
    }
}

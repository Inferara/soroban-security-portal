namespace SorobanSecurityPortalApi.Models.ViewModels
{
    public class FileViewModel
    {
        public int Id { get; set; }
        public string ContainerGuid { get; set; } = "";
        public string Name { get; set; } = "";
        public string Type { get; set; } = "";
        public byte[]? BinFile { get; set; } = null;
        public DateTime Date { get; set; }
        public string Author { get; set; } = "";
    }
}

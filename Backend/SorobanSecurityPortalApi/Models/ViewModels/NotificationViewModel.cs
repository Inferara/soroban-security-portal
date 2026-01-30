namespace SorobanSecurityPortalApi.Models.ViewModels
{
    public class NotificationViewModel
    {
        public int Id { get; set; }
        public string Message { get; set; } = "";
        public string Link { get; set; } = "";
        public string Type { get; set; } = "";
        public int? ThreadId { get; set; }
        public bool IsRead { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}

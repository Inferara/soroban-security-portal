namespace SorobanSecurityPortalApi.Models.ViewModels
{
    public class ThreadViewModel
    {
        public int Id { get; set; }
        public int VulnerabilityId { get; set; }
        public DateTime CreatedAt { get; set; }
        public int CreatedBy { get; set; }
        public List<ThreadReplyViewModel> Replies { get; set; } = new();
        public bool IsUserWatching { get; set; }
    }

    public class ThreadReplyViewModel
    {
        public int Id { get; set; }
        public string Content { get; set; } = "";
        public string CreatedByName { get; set; } = "";
        public int CreatedBy { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}

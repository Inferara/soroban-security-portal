namespace SorobanSecurityPortalApi.Services.Moderation
{
    public class ModerationTargetInfo
    {
        public string Preview { get; set; } = string.Empty;
        public string FullContent { get; set; } = string.Empty;
        public int AuthorUserId { get; set; }
        public bool IsHidden { get; set; }
        public bool IsDeleted { get; set; }
    }
}

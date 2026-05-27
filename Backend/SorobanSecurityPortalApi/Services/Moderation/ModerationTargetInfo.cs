namespace SorobanSecurityPortalApi.Services.Moderation
{
    public class ModerationTargetInfo
    {
        public string Preview { get; set; } = string.Empty;
        public string FullContent { get; set; } = string.Empty;
        public int AuthorUserId { get; set; }
        public bool IsHidden { get; set; }
        public bool IsDeleted { get; set; }
        // The page a moderator should open to see this content in context, e.g.
        // "vulnerability"/4 or "protocol"/17. For content that lives on a parent
        // (comments, ratings) this points at the parent; vulnerabilities and
        // reports point at themselves. Empty type => no navigable page.
        public string ContextType { get; set; } = string.Empty;
        public int ContextId { get; set; }
    }
}

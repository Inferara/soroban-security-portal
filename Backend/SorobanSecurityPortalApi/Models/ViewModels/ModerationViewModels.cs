namespace SorobanSecurityPortalApi.Models.ViewModels
{
    public class FlagContentRequest
    {
        public string ContentType { get; set; } = string.Empty;
        public int ContentId { get; set; }
        public string Reason { get; set; } = string.Empty;
        public string? Comment { get; set; }
    }

    public class ModerationActionRequest
    {
        public string ContentType { get; set; } = string.Empty;
        public int ContentId { get; set; }
        public string Action { get; set; } = string.Empty;
        public string? Reason { get; set; }
    }

    public class ModerationAuthorViewModel
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public int ReputationScore { get; set; }
        public string? AvatarUrl { get; set; }
    }

    public class ModerationActionViewModel
    {
        public string Id { get; set; } = string.Empty;
        public string ModeratorId { get; set; } = string.Empty;
        public string ModeratorName { get; set; } = string.Empty;
        public string Action { get; set; } = string.Empty;
        public string? Reason { get; set; }
        public string Timestamp { get; set; } = string.Empty;
    }

    public class ContentFlagDetailViewModel
    {
        public string Reason { get; set; } = string.Empty;
        public string? Comment { get; set; }
        public string CreatedAt { get; set; } = string.Empty;
    }

    public class FlaggedContentViewModel
    {
        public string Id { get; set; } = string.Empty;
        public string ContentType { get; set; } = string.Empty;
        public string ContentId { get; set; } = string.Empty;
        public string ContentPreview { get; set; } = string.Empty;
        public string FullContent { get; set; } = string.Empty;
        public ModerationAuthorViewModel Author { get; set; } = new();
        public int FlagCount { get; set; }
        public Dictionary<string, int> Reasons { get; set; } = new();
        // The individual reports against this content — each flagger's reason + the note they wrote.
        public List<ContentFlagDetailViewModel> Flags { get; set; } = new();
        public string FirstFlaggedAt { get; set; } = string.Empty;
        public string LastFlaggedAt { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public List<ModerationActionViewModel> ModerationHistory { get; set; } = new();
    }

    public class ModerationStatsViewModel
    {
        public int QueueSize { get; set; }
        public int ActionsToday { get; set; }
        public int ActionsThisWeek { get; set; }
        public int ActionsThisMonth { get; set; }
    }
}

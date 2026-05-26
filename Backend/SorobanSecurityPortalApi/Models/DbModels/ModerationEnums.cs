namespace SorobanSecurityPortalApi.Models.DbModels
{
    public enum ModeratedContentType { Vulnerability = 1, Report = 2, Rating = 3, Comment = 4 }
    public enum FlagReason { Spam = 1, Harassment = 2, Inappropriate = 3, Misinformation = 4, Other = 5 }
    public enum ModerationActionType { Approve = 1, Hide = 2, Delete = 3 }
}

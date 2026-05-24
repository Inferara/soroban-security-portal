using SorobanSecurityPortalApi.Models.DbModels;

namespace SorobanSecurityPortalApi.Services.Moderation
{
    public static class ModerationParsing
    {
        public static bool TryContentType(string s, out ModeratedContentType t)
        {
            switch ((s ?? "").ToLowerInvariant())
            {
                case "vulnerability": t = ModeratedContentType.Vulnerability; return true;
                case "report": t = ModeratedContentType.Report; return true;
                default: t = default; return false;
            }
        }

        public static string ContentTypeString(ModeratedContentType t)
            => t == ModeratedContentType.Vulnerability ? "vulnerability" : "report";

        public static bool TryReason(string s, out FlagReason r)
            => Enum.TryParse(s, true, out r) && Enum.IsDefined(typeof(FlagReason), r);

        public static string ReasonString(FlagReason r) => r.ToString().ToLowerInvariant();

        public static bool TryAction(string s, out ModerationActionType a)
            => Enum.TryParse(s, true, out a) && Enum.IsDefined(typeof(ModerationActionType), a);

        public static string ActionToStatus(ModerationActionType a) => a switch
        {
            ModerationActionType.Approve => "approved",
            ModerationActionType.Hide => "hidden",
            ModerationActionType.Delete => "deleted",
            _ => "pending"
        };
    }
}

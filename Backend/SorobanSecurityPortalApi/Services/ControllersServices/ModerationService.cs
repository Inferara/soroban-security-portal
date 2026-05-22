using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;
using SorobanSecurityPortalApi.Services.Moderation;

namespace SorobanSecurityPortalApi.Services.ControllersServices
{
    public interface IModerationService
    {
        Task<List<FlaggedContentViewModel>> GetQueue(string? status, string? contentType, int page, int pageSize = 20);
        Task<Result<bool, string>> TakeAction(ModerationActionRequest request);
        Task<ModerationStatsViewModel> GetStats();
    }

    public class ModerationService : IModerationService
    {
        private readonly IContentFlagProcessor _flagProcessor;
        private readonly IModerationActionProcessor _actionProcessor;
        private readonly IModerationTargetRegistry _registry;
        private readonly IUserContextAccessor _userContext;
        private readonly ILoginProcessor _loginProcessor;
        private readonly IUserProfileProcessor _userProfileProcessor;

        public ModerationService(
            IContentFlagProcessor flagProcessor,
            IModerationActionProcessor actionProcessor,
            IModerationTargetRegistry registry,
            IUserContextAccessor userContext,
            ILoginProcessor loginProcessor,
            IUserProfileProcessor userProfileProcessor)
        {
            _flagProcessor = flagProcessor;
            _actionProcessor = actionProcessor;
            _registry = registry;
            _userContext = userContext;
            _loginProcessor = loginProcessor;
            _userProfileProcessor = userProfileProcessor;
        }

        public async Task<List<FlaggedContentViewModel>> GetQueue(string? status, string? contentType, int page, int pageSize = 20)
        {
            page = Math.Max(1, page);
            pageSize = Math.Max(1, Math.Min(100, pageSize));

            var queue = await BuildQueue(status, contentType);

            return queue
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToList();
        }

        // Builds the full aggregated + filtered + ordered queue WITHOUT pagination.
        // Pagination is applied by GetQueue; GetStats uses this directly so QueueSize is never capped.
        private async Task<List<FlaggedContentViewModel>> BuildQueue(string? status, string? contentType)
        {
            var allFlags = await _flagProcessor.GetAll();
            var allActions = await _actionProcessor.GetAll();

            // Group flags by (ContentType, ContentId)
            var flagGroups = allFlags
                .GroupBy(f => (f.ContentType, f.ContentId))
                .ToList();

            // Pass 1: resolve each group's content info and the actions that apply to it,
            // skipping groups whose content is missing/unresolvable. Defer author/moderator
            // lookups so we can batch them (no per-item DB calls).
            var items = new List<(
                (ModeratedContentType ContentType, int ContentId) Key,
                ModerationTargetInfo Info,
                IGrouping<(ModeratedContentType, int), ContentFlagModel> Group,
                List<ModerationActionModel> Actions,
                DateTime MaxFlagDate,
                string Status)>();

            foreach (var group in flagGroups)
            {
                var key = group.Key;

                if (!_registry.TryGet(key.ContentType, out var target))
                    continue;

                var info = await target.Get(key.ContentId);
                if (info == null)
                    continue;

                // Last action for this content item
                var actionsForKey = allActions
                    .Where(a => a.ContentType == key.ContentType && a.ContentId == key.ContentId)
                    .OrderBy(a => a.CreatedAt)
                    .ToList();

                var lastAction = actionsForKey.Count > 0 ? actionsForKey[actionsForKey.Count - 1] : null;
                var maxFlagDate = group.Max(f => f.CreatedAt);

                // Re-queue: if a flag is newer than the last action, treat as pending again
                string itemStatus;
                if (lastAction == null || maxFlagDate > lastAction.CreatedAt)
                    itemStatus = "pending";
                else
                    itemStatus = ModerationParsing.ActionToStatus(lastAction.Action);

                items.Add((key, info, group, actionsForKey, maxFlagDate, itemStatus));
            }

            // Collect every login id we need: content authors PLUS every moderator referenced
            // in the actions. Look each distinct id up exactly once.
            var authorIds = items.Select(i => i.Info.AuthorUserId).ToHashSet();
            var moderatorIds = items.SelectMany(i => i.Actions.Select(a => a.ModeratorId)).ToHashSet();
            var allLoginIds = new HashSet<int>(authorIds);
            allLoginIds.UnionWith(moderatorIds);

            var loginDict = new Dictionary<int, LoginModel?>();
            foreach (var id in allLoginIds)
                loginDict[id] = await _loginProcessor.GetById(id);

            var reputationDict = new Dictionary<int, int>();
            foreach (var id in authorIds)
            {
                var profile = await _userProfileProcessor.GetByLoginIdAsync(id);
                reputationDict[id] = profile?.ReputationScore ?? 0;
            }

            // Pass 2: build the view models from the in-memory dictionaries.
            var result = new List<(FlaggedContentViewModel Vm, DateTime MaxFlagDate)>();

            foreach (var item in items)
            {
                var key = item.Key;
                var info = item.Info;
                var group = item.Group;

                var authorLogin = loginDict.TryGetValue(info.AuthorUserId, out var al) ? al : null;
                var authorName = authorLogin?.FullName ?? string.Empty;
                var authorEmail = authorLogin?.Email ?? string.Empty;
                var authorReputation = reputationDict.TryGetValue(info.AuthorUserId, out var rep) ? rep : 0;

                var typeStr = ModerationParsing.ContentTypeString(key.ContentType);
                var contentIdStr = key.ContentId.ToString();

                var vm = new FlaggedContentViewModel
                {
                    Id = $"{typeStr}:{contentIdStr}",
                    ContentType = typeStr,
                    ContentId = contentIdStr,
                    ContentPreview = info.Preview,
                    FullContent = info.FullContent,
                    Author = new ModerationAuthorViewModel
                    {
                        Id = info.AuthorUserId.ToString(),
                        Name = authorName,
                        Email = authorEmail,
                        ReputationScore = authorReputation,
                        AvatarUrl = null
                    },
                    FlagCount = group.Count(),
                    Reasons = group
                        .GroupBy(f => f.Reason)
                        .ToDictionary(
                            g => ModerationParsing.ReasonString(g.Key),
                            g => g.Count()),
                    FirstFlaggedAt = group.Min(f => f.CreatedAt).ToString("o"),
                    LastFlaggedAt = item.MaxFlagDate.ToString("o"),
                    Status = item.Status,
                    ModerationHistory = item.Actions
                        .Select(a => new ModerationActionViewModel
                        {
                            Id = a.Id.ToString(),
                            ModeratorId = a.ModeratorId.ToString(),
                            ModeratorName = loginDict.TryGetValue(a.ModeratorId, out var l) && l != null ? l.FullName : string.Empty,
                            Action = ModerationParsing.ActionToStatus(a.Action),
                            Reason = a.Reason,
                            Timestamp = a.CreatedAt.ToString("o")
                        })
                        .ToList()
                };

                result.Add((vm, item.MaxFlagDate));
            }

            var filtered = result.AsEnumerable();

            // Apply status filter
            if (!string.IsNullOrEmpty(status))
                filtered = filtered.Where(r => r.Vm.Status == status);

            // Apply content type filter
            if (!string.IsNullOrEmpty(contentType))
                filtered = filtered.Where(r => r.Vm.ContentType == contentType);

            // Order by last flagged descending using the raw DateTime (not the ISO string,
            // which avoids lexicographic-sort fragility). Pagination is applied by the caller.
            return filtered
                .OrderByDescending(r => r.MaxFlagDate)
                .Select(r => r.Vm)
                .ToList();
        }

        public async Task<Result<bool, string>> TakeAction(ModerationActionRequest request)
        {
            if (!ModerationParsing.TryContentType(request.ContentType, out var type))
                return new Result<bool, string>.Err("Invalid content type");

            if (!ModerationParsing.TryAction(request.Action, out var action))
                return new Result<bool, string>.Err("Invalid action");

            if ((action == ModerationActionType.Hide || action == ModerationActionType.Delete)
                && string.IsNullOrWhiteSpace(request.Reason))
                return new Result<bool, string>.Err("Reason is required for hide/delete");

            if (!_registry.TryGet(type, out var target))
                return new Result<bool, string>.Err("Invalid content type");

            var moderatorId = await _userContext.GetLoginIdAsync();

            // Not transactional, but ordered: apply the content side-effect FIRST, then record
            // the action. If the side-effect throws, no phantom moderation_action is persisted.
            switch (action)
            {
                case ModerationActionType.Approve:
                    await target.Restore(request.ContentId);
                    break;
                case ModerationActionType.Hide:
                    await target.Hide(request.ContentId);
                    break;
                case ModerationActionType.Delete:
                    await target.SoftDelete(request.ContentId);
                    break;
            }

            await _actionProcessor.Add(new ModerationActionModel
            {
                ContentType = type,
                ContentId = request.ContentId,
                ModeratorId = moderatorId,
                Action = action,
                Reason = request.Reason,
                CreatedAt = DateTime.UtcNow
            });

            return new Result<bool, string>.Ok(true);
        }

        public async Task<ModerationStatsViewModel> GetStats()
        {
            var pending = await BuildQueue("pending", null);
            var now = DateTime.UtcNow;

            return new ModerationStatsViewModel
            {
                QueueSize = pending.Count,
                ActionsToday = await _actionProcessor.CountSince(now.Date),
                ActionsThisWeek = await _actionProcessor.CountSince(now.Date.AddDays(-7)),
                ActionsThisMonth = await _actionProcessor.CountSince(now.Date.AddMonths(-1))
            };
        }
    }
}

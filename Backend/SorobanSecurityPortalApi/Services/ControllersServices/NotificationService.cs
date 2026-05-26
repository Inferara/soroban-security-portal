using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using AutoMapper;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;
using SorobanSecurityPortalApi.Services.Realtime;

namespace SorobanSecurityPortalApi.Services.ControllersServices
{
    public interface INotificationService
    {
        Task<List<NotificationViewModel>> GetNotifications(NotificationType? type, int page);
        Task<int> GetUnreadCount();
        Task MarkRead(int id);
        Task MarkAllRead();
        Task NotifyForNewComment(int actorId, int? repliedToAuthorId, IReadOnlyList<int> mentionedUserIds,
            int commentId, EntityType entityType, int entityId, string preview);
    }

    public class NotificationService : INotificationService
    {
        public const int MaxMentionNotifications = 10;
        private const int PreviewMaxLength = 280;

        private readonly INotificationProcessor _processor;
        private readonly IUserContextAccessor _userContext;
        private readonly IMapper _mapper;
        private readonly IRealtimePublisher _realtimePublisher;
        private readonly ILoginProcessor _loginProcessor;

        public NotificationService(INotificationProcessor processor, IUserContextAccessor userContext, IMapper mapper, IRealtimePublisher realtimePublisher, ILoginProcessor loginProcessor)
        {
            _processor = processor;
            _userContext = userContext;
            _mapper = mapper;
            _realtimePublisher = realtimePublisher;
            _loginProcessor = loginProcessor;
        }

        public async Task<List<NotificationViewModel>> GetNotifications(NotificationType? type, int page)
        {
            var userId = await _userContext.GetLoginIdAsync();
            var rows = await _processor.ListForUser(userId, type, page, 20);
            var vms = _mapper.Map<List<NotificationViewModel>>(rows);
            var names = await _loginProcessor.GetDisplayNames(rows.Select(r => r.ActorUserId).Distinct().ToList());
            foreach (var vm in vms)
                vm.ActorName = names.TryGetValue(vm.ActorUserId, out var n) && !string.IsNullOrWhiteSpace(n) ? n : "Unknown";
            return vms;
        }

        public async Task<int> GetUnreadCount() => await _processor.UnreadCount(await _userContext.GetLoginIdAsync());

        public async Task MarkRead(int id) => await _processor.MarkRead(id, await _userContext.GetLoginIdAsync());

        public async Task MarkAllRead() => await _processor.MarkAllRead(await _userContext.GetLoginIdAsync());

        public async Task NotifyForNewComment(int actorId, int? repliedToAuthorId, IReadOnlyList<int> mentionedUserIds,
            int commentId, EntityType entityType, int entityId, string preview)
        {
            preview = preview?.Length > PreviewMaxLength ? preview.Substring(0, PreviewMaxLength) : (preview ?? string.Empty);
            var notifications = new List<NotificationModel>();

            // Reply notification to the comment being replied to (never to yourself).
            if (repliedToAuthorId.HasValue && repliedToAuthorId.Value != actorId)
                notifications.Add(Make(repliedToAuthorId.Value, NotificationType.CommentReply, actorId, commentId, entityType, entityId, preview));

            // Mention notifications: exclude the actor and the reply recipient (no double-notify), dedupe, cap.
            var mentionTargets = (mentionedUserIds ?? new List<int>())
                .Where(id => id != actorId && id != repliedToAuthorId)
                .Distinct()
                .Take(MaxMentionNotifications);
            foreach (var uid in mentionTargets)
                notifications.Add(Make(uid, NotificationType.Mention, actorId, commentId, entityType, entityId, preview));

            if (notifications.Count > 0)
            {
                await _processor.AddRange(notifications);
                // Best-effort live push (persisted copy is the source of truth; a push failure
                // just means the recipient sees it on next poll/reconnect).
                var actorNames = await _loginProcessor.GetDisplayNames(new List<int> { actorId });
                var actorName = actorNames.TryGetValue(actorId, out var an) && !string.IsNullOrWhiteSpace(an) ? an : "Unknown";
                foreach (var n in notifications)
                {
                    var vm = _mapper.Map<NotificationViewModel>(n);
                    vm.ActorName = actorName;
                    try { await _realtimePublisher.NotifyUserAsync(n.RecipientUserId, vm); }
                    catch { /* swallow — delivery is best-effort */ }
                }
            }
        }

        private static NotificationModel Make(int recipient, NotificationType type, int actor, int commentId, EntityType et, int eid, string preview)
            => new()
            {
                RecipientUserId = recipient,
                Type = type,
                ActorUserId = actor,
                CommentId = commentId,
                EntityType = et,
                EntityId = eid,
                Preview = preview,
                CreatedAt = DateTime.UtcNow
            };
    }
}

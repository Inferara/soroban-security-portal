using System;
using SorobanSecurityPortalApi.Models.DbModels;

namespace SorobanSecurityPortalApi.Models.ViewModels
{
    public class NotificationViewModel
    {
        public int Id { get; set; }
        public NotificationType Type { get; set; }
        public int ActorUserId { get; set; }
        public int CommentId { get; set; }
        public EntityType EntityType { get; set; }
        public int EntityId { get; set; }
        public string Preview { get; set; } = string.Empty;
        public bool IsRead { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}

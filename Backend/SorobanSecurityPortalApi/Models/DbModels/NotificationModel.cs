using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SorobanSecurityPortalApi.Models.DbModels
{
    public enum NotificationType
    {
        CommentReply = 1,
        Mention = 2
    }

    [Table("notification")]
    public class NotificationModel
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int RecipientUserId { get; set; }

        [Required]
        public NotificationType Type { get; set; }

        [Required]
        public int ActorUserId { get; set; }

        // The comment that triggered the notification, plus its host entity (for deep-linking
        // to e.g. /vulnerability/{EntityId}#comment-{CommentId}).
        [Required]
        public int CommentId { get; set; }

        [Required]
        public EntityType EntityType { get; set; }

        [Required]
        public int EntityId { get; set; }

        [MaxLength(280)]
        public string Preview { get; set; } = string.Empty;

        public bool IsRead { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}

using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SorobanSecurityPortalApi.Models.DbModels
{
    [Table("notification")]
    public class NotificationModel
    {
        [Key]
        public int Id { get; set; }

        [ForeignKey("Recipient")]
        public int RecipientUserId { get; set; }
        public LoginModel Recipient { get; set; } = null!;

        [ForeignKey("Sender")]
        public int SenderUserId { get; set; }
        public LoginModel Sender { get; set; } = null!;

        public string Type { get; set; } = string.Empty; // "mention", "comment", etc.
        public string Title { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;

        // Related entity
        public string EntityType { get; set; } = string.Empty; // "report", "vulnerability", etc.
        public int EntityId { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public bool IsRead { get; set; } = false;

        // Optional URL to navigate to
        public string? ActionUrl { get; set; }
    }

    public enum NotificationType
    {
        Mention = 1,
        Comment = 2,
        System = 3
    }
}
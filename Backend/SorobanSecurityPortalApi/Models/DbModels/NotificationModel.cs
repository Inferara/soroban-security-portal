using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SorobanSecurityPortalApi.Models.DbModels
{
    [Table("notification")]
    public class NotificationModel
    {
        [Key]
        public int Id { get; set; }
        
        public int UserId { get; set; } // FK to LoginModel.LoginId
        public string Message { get; set; } = "";
        public string Link { get; set; } = "";
        public string Type { get; set; } = ""; // "Reply", "System"
        public int? ThreadId { get; set; }
        public bool IsRead { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}

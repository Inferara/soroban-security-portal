using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SorobanSecurityPortalApi.Models.DbModels
{
    [Table("thread_subscription")]
    public class ThreadSubscriptionModel
    {
        [Key]
        public int Id { get; set; }
        
        [ForeignKey("Thread")]
        public int ThreadId { get; set; }
        public ThreadModel? Thread { get; set; }
        
        public int UserId { get; set; } // FK to LoginModel.LoginId
        public bool IsWatching { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}

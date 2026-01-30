using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SorobanSecurityPortalApi.Models.DbModels
{
    [Table("thread_reply")]
    public class ThreadReplyModel
    {
        [Key]
        public int Id { get; set; }
        
        [ForeignKey("Thread")]
        public int ThreadId { get; set; }
        public ThreadModel? Thread { get; set; }
        
        public string Content { get; set; } = "";
        public int CreatedBy { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}

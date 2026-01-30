using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SorobanSecurityPortalApi.Models.DbModels
{
    [Table("thread")]
    public class ThreadModel
    {
        [Key]
        public int Id { get; set; }
        
        [ForeignKey("Vulnerability")]
        public int VulnerabilityId { get; set; }
        public VulnerabilityModel? Vulnerability { get; set; }
        
        public DateTime CreatedAt { get; set; }
        public int CreatedBy { get; set; }

        public virtual ICollection<ThreadReplyModel> Replies { get; set; } = new List<ThreadReplyModel>();
        public virtual ICollection<ThreadSubscriptionModel> Subscriptions { get; set; } = new List<ThreadSubscriptionModel>();
    }
}

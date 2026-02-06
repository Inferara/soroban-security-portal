using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using SorobanSecurityPortalApi.Models.DbModels;

namespace SorobanSecurityPortalApi.Models.DbModels
{
    [Table("user_badges")]
    public class UserBadgeModel
    {
        [Key] 
        public int Id { get; set; }

        public int UserProfileId { get; set; } 
        
        [ForeignKey("UserProfileId")]
        public virtual UserProfileModel UserProfile { get; set; } = null!;

        public int BadgeId { get; set; } 
        
        [ForeignKey("BadgeId")]
        public virtual BadgeDefinitionModel Badge { get; set; } = null!;

        public DateTime AwardedAt { get; set; } = DateTime.UtcNow;
    }
}

using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using SorobanSecurityPortalApi.Models.DbModels;


public class UserBadgeModel
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    public int UserProfileId { get; set; } 
    
    [ForeignKey("UserProfileId")]
    public virtual UserProfileModel UserProfile { get; set; } = null!;

    public Guid BadgeId { get; set; }
    
    [ForeignKey("BadgeId")]
    public virtual BadgeDefinitionModel Badge { get; set; } = null!;

    public DateTime AwardedAt { get; set; } = DateTime.UtcNow;
}


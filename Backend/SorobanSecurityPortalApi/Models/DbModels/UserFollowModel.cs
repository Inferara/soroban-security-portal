using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SorobanSecurityPortalApi.Models.DbModels
{
    [Table("user_follow")]
    public class UserFollowModel
    {
        [Key] 
        public int Id { get; set; }
        public int LoginId { get; set; }
        public FollowEntityType EntityType { get; set; }
        public int EntityId { get; set; }
        public DateTime FollowedAt { get; set; }
    }

    public enum FollowEntityType
    {
        Protocol = 1,
        Auditor = 2,
        Company = 3
    }
}

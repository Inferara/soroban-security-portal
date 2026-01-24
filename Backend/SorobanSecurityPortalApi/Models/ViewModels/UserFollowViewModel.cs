using SorobanSecurityPortalApi.Models.DbModels;

namespace SorobanSecurityPortalApi.Models.ViewModels
{
    public class UserFollowViewModel
    {
        public int Id { get; set; }
        public int LoginId { get; set; }
        public FollowEntityType EntityType { get; set; }
        public int EntityId { get; set; }
        public string EntityName { get; set; } = "";
        public DateTime FollowedAt { get; set; }
    }

    public class CreateFollowViewModel
    {
        public FollowEntityType EntityType { get; set; }
        public int EntityId { get; set; }
    }
}

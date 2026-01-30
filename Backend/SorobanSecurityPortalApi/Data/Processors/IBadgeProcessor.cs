using SorobanSecurityPortalApi.Models.DbModels;


namespace SorobanSecurityPortalApi.Data.Processors
{
    public interface IBadgeProcessor
    {
        Task<List<BadgeDefinitionModel>> GetAllBadgeDefinitions();
        Task<List<UserBadgeModel>> GetUserBadges(int userProfileId); 
        Task<bool> HasBadge(int userProfileId, Guid badgeId);      
        Task<bool> AwardBadge(int userProfileId, Guid badgeId);     
    }
}

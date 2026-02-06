using SorobanSecurityPortalApi.Models.DbModels;
using System.Collections.Generic;
using System.Threading.Tasks;


namespace SorobanSecurityPortalApi.Data.Processors
{
    public interface IBadgeProcessor
    {
        Task<List<BadgeDefinitionModel>> GetAllBadgeDefinitions();
        Task<List<UserBadgeModel>> GetUserBadges(int userProfileId); 
        Task<bool> HasBadge(int userProfileId, int badgeId);      
        Task<bool> AwardBadge(int userProfileId, int badgeId);    
    }
}

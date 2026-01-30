using Microsoft.Extensions.Logging;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.DbModels;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace SorobanSecurityPortalApi.Services.ProcessingServices
{
    public interface IBadgeAwardService
    {
        Task CheckAndAwardReputationBadges(int userProfileId, int currentReputation);
        Task AwardSpecificBadge(int userProfileId, string criteriaKey);
    }

    public class BadgeAwardService : IBadgeAwardService
    {
        private readonly IBadgeProcessor _badgeProcessor;
        private readonly ILogger<BadgeAwardService> _logger;

        public BadgeAwardService(IBadgeProcessor badgeProcessor, ILogger<BadgeAwardService> logger)
        {
            _badgeProcessor = badgeProcessor;
            _logger = logger;
        }

        public async Task CheckAndAwardReputationBadges(int userProfileId, int currentReputation)
        {
            try
            {
                var allBadges = await _badgeProcessor.GetAllBadgeDefinitions();
                
                var reputationBadges = allBadges.Where(b => b.Criteria.StartsWith("reputation:", StringComparison.OrdinalIgnoreCase));

                foreach (var badge in reputationBadges)
                {
                    var parts = badge.Criteria.Split(':');
                    if (parts.Length > 1 && int.TryParse(parts[1], out int requiredReputation))
                    {
                        if (currentReputation >= requiredReputation)
                        {
                            bool awarded = await _badgeProcessor.AwardBadge(userProfileId, badge.Id);
                            if (awarded)
                            {
                                _logger.LogInformation("Badge {BadgeName} awarded to user {UserId}", badge.Name, userProfileId);
                            }
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking reputation badges for user {UserId}", userProfileId);
            }
        }

        public async Task AwardSpecificBadge(int userProfileId, string criteriaKey)
        {
            try
            {
                var allBadges = await _badgeProcessor.GetAllBadgeDefinitions();
                var badge = allBadges.FirstOrDefault(b => b.Criteria.Equals(criteriaKey, StringComparison.OrdinalIgnoreCase));

                if (badge != null)
                {
                    await _badgeProcessor.AwardBadge(userProfileId, badge.Id);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error awarding specific badge {Criteria} to user {UserId}", criteriaKey, userProfileId);
            }
        }
    }
}


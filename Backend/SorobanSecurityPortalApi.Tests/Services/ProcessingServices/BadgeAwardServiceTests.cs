using Moq;
using Xunit;
using Microsoft.Extensions.Logging;
using SorobanSecurityPortalApi.Services.ProcessingServices;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.DbModels;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace SorobanSecurityPortalApi.Tests.Services
{
    public class BadgeAwardServiceTests
    {
        private readonly Mock<IBadgeProcessor> _mockProcessor;
        private readonly Mock<ILogger<BadgeAwardService>> _mockLogger;
        private readonly BadgeAwardService _service;

        public BadgeAwardServiceTests()
        {
            _mockProcessor = new Mock<IBadgeProcessor>();
            _mockLogger = new Mock<ILogger<BadgeAwardService>>();
            _service = new BadgeAwardService(_mockProcessor.Object, _mockLogger.Object);
        }

        [Fact]
        public async Task CheckAndAwardReputationBadges_ShouldAward_WhenReputationThresholdMet()
        {
            int userId = 1;
            int userReputation = 500;
            int goldBadgeId = 10;
            int eliteBadgeId = 11; 

            var badgeDefinitions = new List<BadgeDefinitionModel>
            {
                new BadgeDefinitionModel 
                { 
                    Id = goldBadgeId, 
                    Name = "Gold Contributor", 
                    Criteria = "reputation:400" 
                },
                new BadgeDefinitionModel 
                { 
                    Id = eliteBadgeId, 
                    Name = "Elite Contributor", 
                    Criteria = "reputation:1000" 
                }
            };

            _mockProcessor.Setup(p => p.GetAllBadgeDefinitions())
                .ReturnsAsync(badgeDefinitions);

            _mockProcessor.Setup(p => p.AwardBadge(userId, goldBadgeId))
                .ReturnsAsync(true);

            await _service.CheckAndAwardReputationBadges(userId, userReputation);

            _mockProcessor.Verify(p => p.AwardBadge(userId, goldBadgeId), Times.Once);
            
            _mockProcessor.Verify(p => p.AwardBadge(userId, eliteBadgeId), Times.Never);
        }

        [Fact]
        public async Task AwardSpecificBadge_ShouldInvokeProcessor_WhenCriteriaMatches()
        {
            int userId = 1;
            string criteria = "first_comment";
            int badgeId = 1; 

            var badgeDefinitions = new List<BadgeDefinitionModel>
            {
                new BadgeDefinitionModel { Id = badgeId, Criteria = "first_comment" }
            };

            _mockProcessor.Setup(p => p.GetAllBadgeDefinitions())
                .ReturnsAsync(badgeDefinitions);

            await _service.AwardSpecificBadge(userId, criteria);

            _mockProcessor.Verify(p => p.AwardBadge(userId, badgeId), Times.Once);
        }

        [Fact]
        public async Task CheckAndAwardReputationBadges_ShouldHandleInvalidCriteriaGracefully()
        {
            int userId = 1;
            var badgeDefinitions = new List<BadgeDefinitionModel>
            {
                new BadgeDefinitionModel { Id = 99, Criteria = "reputation:abc" }
            };

            _mockProcessor.Setup(p => p.GetAllBadgeDefinitions())
                .ReturnsAsync(badgeDefinitions);

            await _service.CheckAndAwardReputationBadges(userId, 100);

            _mockProcessor.Verify(p => p.AwardBadge(It.IsAny<int>(), It.IsAny<int>()), Times.Never);
        }
    }
}

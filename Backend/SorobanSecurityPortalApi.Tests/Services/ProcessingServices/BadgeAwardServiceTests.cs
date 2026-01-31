using Moq;
using Xunit;
using Microsoft.Extensions.Logging;
using SorobanSecurityPortalApi.Services.ProcessingServices;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.DbModels;
using System;
using System.Collections.Generic;
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
            // Arrange
            int userId = 1;
            int userReputation = 500;
            var badgeId = Guid.NewGuid();

            var badgeDefinitions = new List<BadgeDefinitionModel>
            {
                new BadgeDefinitionModel 
                { 
                    Id = badgeId, 
                    Name = "Gold Contributor", 
                    Criteria = "reputation:400" 
                },
                new BadgeDefinitionModel 
                { 
                    Id = Guid.NewGuid(), 
                    Name = "Elite Contributor", 
                    Criteria = "reputation:1000" 
                }
            };

            _mockProcessor.Setup(p => p.GetAllBadgeDefinitions())
                .ReturnsAsync(badgeDefinitions);

            _mockProcessor.Setup(p => p.AwardBadge(userId, badgeId))
                .ReturnsAsync(true);

            await _service.CheckAndAwardReputationBadges(userId, userReputation);

            _mockProcessor.Verify(p => p.AwardBadge(userId, badgeId), Times.Once);
            
            _mockProcessor.Verify(p => p.AwardBadge(userId, It.Is<Guid>(g => g != badgeId)), Times.Never);
        }

        [Fact]
        public async Task AwardSpecificBadge_ShouldInvokeProcessor_WhenCriteriaMatches()
        {
            int userId = 1;
            string criteria = "first_comment";
            var badgeId = Guid.NewGuid();

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
                new BadgeDefinitionModel { Id = Guid.NewGuid(), Criteria = "reputation:abc" }
            };

            _mockProcessor.Setup(p => p.GetAllBadgeDefinitions())
                .ReturnsAsync(badgeDefinitions);

            await _service.CheckAndAwardReputationBadges(userId, 100);

            _mockProcessor.Verify(p => p.AwardBadge(It.IsAny<int>(), It.IsAny<Guid>()), Times.Never);
        }
    }
}
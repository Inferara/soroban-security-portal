using Moq;
using Xunit;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using SorobanSecurityPortalApi.Services.ProcessingServices;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.DbModels;
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
            int userId = 1;
            int userReputation = 500;
            int goldBadgeId = 10;

            var badges = new List<BadgeDefinitionModel> {
                new BadgeDefinitionModel { Id = goldBadgeId, Name = "Gold", Criteria = "reputation:400" }
            };

            _mockProcessor.Setup(p => p.GetAllBadgeDefinitions()).ReturnsAsync(badges);
            _mockProcessor.Setup(p => p.AwardBadge(userId, goldBadgeId)).ReturnsAsync(true);

            await _service.CheckAndAwardReputationBadges(userId, userReputation);

            _mockProcessor.Verify(p => p.AwardBadge(userId, goldBadgeId), Times.Once);
        }

        [Fact]
        public async Task AwardSpecificBadge_ShouldInvokeProcessor_WhenCriteriaMatches()
        {
            int userId = 1, badgeId = 1;
            var badges = new List<BadgeDefinitionModel> {
                new BadgeDefinitionModel { Id = badgeId, Criteria = "first_comment" }
            };

            _mockProcessor.Setup(p => p.GetAllBadgeDefinitions()).ReturnsAsync(badges);

            await _service.AwardSpecificBadge(userId, "first_comment");

            _mockProcessor.Verify(p => p.AwardBadge(userId, badgeId), Times.Once);
        }

        [Fact]
        public async Task CheckAndAwardReputationBadges_ShouldHandleInvalidCriteriaGracefully()
        {
            var badges = new List<BadgeDefinitionModel> {
                new BadgeDefinitionModel { Id = 99, Criteria = "reputation:abc" }
            };

            _mockProcessor.Setup(p => p.GetAllBadgeDefinitions()).ReturnsAsync(badges);

            await _service.CheckAndAwardReputationBadges(1, 100);

            _mockProcessor.Verify(p => p.AwardBadge(It.IsAny<int>(), It.IsAny<int>()), Times.Never);
        }


        [Theory]
        [InlineData(399, false)] 
        [InlineData(400, true)]  
        public async Task CheckAndAward_BoundaryTests(int reputation, bool shouldAward)
        {
            int userId = 1, badgeId = 10;
            var badges = new List<BadgeDefinitionModel> { 
                new BadgeDefinitionModel { Id = badgeId, Criteria = "reputation:400" } 
            };
            
            _mockProcessor.Setup(p => p.GetAllBadgeDefinitions()).ReturnsAsync(badges);

            await _service.CheckAndAwardReputationBadges(userId, reputation);

            _mockProcessor.Verify(p => p.AwardBadge(userId, badgeId), shouldAward ? Times.Once() : Times.Never());
        }

        [Fact]
        public async Task CheckAndAward_ShouldAwardMultipleBadges_WhenUserClearsMultipleThresholds()
        {
            int userId = 1;
            var badges = new List<BadgeDefinitionModel> {
                new BadgeDefinitionModel { Id = 1, Criteria = "reputation:100" },
                new BadgeDefinitionModel { Id = 2, Criteria = "reputation:500" }
            };

            _mockProcessor.Setup(p => p.GetAllBadgeDefinitions()).ReturnsAsync(badges);

            await _service.CheckAndAwardReputationBadges(userId, 600);

            _mockProcessor.Verify(p => p.AwardBadge(userId, 1), Times.Once);
            _mockProcessor.Verify(p => p.AwardBadge(userId, 2), Times.Once);
        }

        [Fact]
        public async Task AwardSpecificBadge_ShouldBeCaseInsensitive()
        {
            int userId = 1, badgeId = 5;
            var badges = new List<BadgeDefinitionModel> { 
                new BadgeDefinitionModel { Id = badgeId, Criteria = "FIRST_COMMENT" } 
            };

            _mockProcessor.Setup(p => p.GetAllBadgeDefinitions()).ReturnsAsync(badges);

            await _service.AwardSpecificBadge(userId, "first_comment");

            _mockProcessor.Verify(p => p.AwardBadge(userId, badgeId), Times.Once);
        }
    }
}

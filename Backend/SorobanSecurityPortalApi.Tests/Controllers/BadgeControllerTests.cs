using Moq;
using Xunit;
using FluentAssertions;
using AutoMapper;
using Microsoft.AspNetCore.Mvc;
using SorobanSecurityPortalApi.Controllers;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace SorobanSecurityPortalApi.Tests.Controllers
{
    public class BadgeControllerTests
    {
        private readonly Mock<IBadgeProcessor> _mockProcessor;
        private readonly Mock<IMapper> _mockMapper;
        private readonly BadgeController _controller;

        public BadgeControllerTests()
        {
            _mockProcessor = new Mock<IBadgeProcessor>();
            _mockMapper = new Mock<IMapper>();
            _controller = new BadgeController(_mockProcessor.Object, _mockMapper.Object);
        }

        [Fact]
        public async Task GetUserBadges_ReturnsOk_WithMappedData()
        {
            // Arrange
            int userId = 1;
            var dbRecords = new List<UserBadgeModel> { new UserBadgeModel { BadgeId = 10 } };
            var viewModels = new List<BadgeViewModel> { new BadgeViewModel { Name = "Test Badge" } };

            _mockProcessor.Setup(p => p.GetUserBadges(userId)).ReturnsAsync(dbRecords);
            _mockMapper.Setup(m => m.Map<List<BadgeViewModel>>(dbRecords)).Returns(viewModels);

            // Act
            var result = await _controller.GetUserBadges(userId);

            // Assert
            var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
            var returnedValue = okResult.Value.Should().BeAssignableTo<List<BadgeViewModel>>().Subject;
            returnedValue.Should().HaveCount(1);
            returnedValue[0].Name.Should().Be("Test Badge");
        }
    }
}
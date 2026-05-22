using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Moq;
using SorobanSecurityPortalApi.Controllers;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;
using SorobanSecurityPortalApi.Services.ControllersServices;
using Xunit;
using FluentAssertions;

namespace SorobanSecurityPortalApi.Tests.Controllers
{
    public class RatingControllerTests
    {
        private readonly Mock<IRatingService> _ratingServiceMock = new();
        private readonly RatingController _controller;

        public RatingControllerTests()
        {
            _controller = new RatingController(_ratingServiceMock.Object);
        }

        [Fact]
        public async Task CreateOrUpdate_Should_ReturnBadRequest_WhenReviewExceeds2000Chars()
        {
            var request = new CreateRatingRequest
            {
                EntityType = EntityType.Protocol,
                EntityId = 1,
                Score = 3,
                Review = new string('x', 2001)
            };

            var result = await _controller.CreateOrUpdate(request);

            var badRequest = result.Should().BeOfType<BadRequestObjectResult>().Subject;
            badRequest.Value.Should().Be("Review must not exceed 2000 characters.");
            _ratingServiceMock.Verify(s => s.AddOrUpdateRating(It.IsAny<CreateRatingRequest>()), Times.Never);
        }

        [Fact]
        public async Task CreateOrUpdate_Should_Accept_ReviewAtExactly2000Chars()
        {
            var request = new CreateRatingRequest
            {
                EntityType = EntityType.Protocol,
                EntityId = 1,
                Score = 3,
                Review = new string('x', 2000)
            };

            _ratingServiceMock
                .Setup(s => s.AddOrUpdateRating(request))
                .ReturnsAsync(new RatingViewModel { Id = 1, Score = 3 });

            var result = await _controller.CreateOrUpdate(request);

            result.Should().BeOfType<OkObjectResult>();
        }

        [Fact]
        public async Task CreateOrUpdate_Should_ReturnBadRequest_WhenScoreOutOfRange()
        {
            var request = new CreateRatingRequest
            {
                EntityType = EntityType.Protocol,
                EntityId = 1,
                Score = 6,
                Review = "ok"
            };

            var result = await _controller.CreateOrUpdate(request);

            result.Should().BeOfType<BadRequestObjectResult>();
            _ratingServiceMock.Verify(s => s.AddOrUpdateRating(It.IsAny<CreateRatingRequest>()), Times.Never);
        }
    }
}

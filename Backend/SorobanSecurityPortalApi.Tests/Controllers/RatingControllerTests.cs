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

        [Fact]
        public async Task CreateOrUpdate_Should_NormalizeNullReviewToEmpty_AndNotFail()
        {
            var request = new CreateRatingRequest
            {
                EntityType = EntityType.Protocol,
                EntityId = 1,
                Score = 4,
                Review = null!
            };

            _ratingServiceMock
                .Setup(s => s.AddOrUpdateRating(It.IsAny<CreateRatingRequest>()))
                .ReturnsAsync(new RatingViewModel { Id = 1, Score = 4 });

            var result = await _controller.CreateOrUpdate(request);

            result.Should().BeOfType<OkObjectResult>();
            // A null review must be coerced to empty string before reaching the NOT NULL column.
            _ratingServiceMock.Verify(s => s.AddOrUpdateRating(It.Is<CreateRatingRequest>(r => r.Review == string.Empty)), Times.Once);
        }

        [Fact]
        public async Task CreateOrUpdate_Should_Return404_WhenEntityMissing()
        {
            var request = new CreateRatingRequest { EntityType = EntityType.Protocol, EntityId = 999, Score = 4, Review = "ok" };
            _ratingServiceMock
                .Setup(s => s.AddOrUpdateRating(It.IsAny<CreateRatingRequest>()))
                .ThrowsAsync(new System.Collections.Generic.KeyNotFoundException("Protocol with id 999 not found."));

            var result = await _controller.CreateOrUpdate(request);

            result.Should().BeOfType<NotFoundObjectResult>();
        }

        [Fact]
        public async Task GetMine_Should_ReturnNoContent_WhenNull()
        {
            _ratingServiceMock.Setup(s => s.GetMyRating(EntityType.Protocol, 1)).ReturnsAsync((RatingViewModel?)null);

            var result = await _controller.GetMine(EntityType.Protocol, 1);

            result.Should().BeOfType<NoContentResult>();
        }

        [Fact]
        public async Task GetMine_Should_ReturnOk_WhenFound()
        {
            _ratingServiceMock.Setup(s => s.GetMyRating(EntityType.Protocol, 1)).ReturnsAsync(new RatingViewModel { Id = 3, Score = 5 });

            var result = await _controller.GetMine(EntityType.Protocol, 1);

            var ok = result.Should().BeOfType<OkObjectResult>().Subject;
            ok.Value.Should().BeOfType<RatingViewModel>().Which.Score.Should().Be(5);
        }

        [Fact]
        public async Task GetMine_Should_ReturnBadRequest_WhenEntityIdInvalid()
        {
            var result = await _controller.GetMine(EntityType.Protocol, 0);
            result.Should().BeOfType<BadRequestObjectResult>();
        }
    }
}

using System.Collections.Generic;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Moq;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Controllers;
using SorobanSecurityPortalApi.Models.ViewModels;
using SorobanSecurityPortalApi.Services.ControllersServices;
using Xunit;

namespace SorobanSecurityPortalApi.Tests.Controllers
{
    public class ContentFlagControllerTests
    {
        private readonly Mock<IContentFlagService> _serviceMock = new();
        private readonly ContentFlagController _controller;

        public ContentFlagControllerTests()
        {
            _controller = new ContentFlagController(_serviceMock.Object);
        }

        [Fact]
        public async Task Flag_ServiceReturnsOk_Returns200Ok()
        {
            var request = new FlagContentRequest { ContentType = "rating", ContentId = 1, Reason = "spam" };
            _serviceMock.Setup(s => s.Flag(request))
                .ReturnsAsync(new Result<bool, string>.Ok(true));

            var result = await _controller.Flag(request);

            result.Should().BeOfType<OkObjectResult>();
        }

        [Fact]
        public async Task Flag_ServiceReturnsContentNotFound_Returns404()
        {
            var request = new FlagContentRequest { ContentType = "rating", ContentId = 99, Reason = "spam" };
            _serviceMock.Setup(s => s.Flag(request))
                .ReturnsAsync(new Result<bool, string>.Err("Content not found"));

            var result = await _controller.Flag(request);

            result.Should().BeOfType<NotFoundObjectResult>();
        }

        [Fact]
        public async Task Flag_ServiceReturnsAlreadyFlagged_Returns409Conflict()
        {
            var request = new FlagContentRequest { ContentType = "rating", ContentId = 1, Reason = "spam" };
            _serviceMock.Setup(s => s.Flag(request))
                .ReturnsAsync(new Result<bool, string>.Err("Already flagged"));

            var result = await _controller.Flag(request);

            result.Should().BeOfType<ConflictObjectResult>();
        }

        [Fact]
        public async Task Flag_ServiceReturnsOtherError_Returns400BadRequest()
        {
            var request = new FlagContentRequest { ContentType = "invalid-type", ContentId = 1, Reason = "spam" };
            _serviceMock.Setup(s => s.Flag(request))
                .ReturnsAsync(new Result<bool, string>.Err("Invalid content type"));

            var result = await _controller.Flag(request);

            result.Should().BeOfType<BadRequestObjectResult>();
        }
    }

    public class ModerationControllerTests
    {
        private readonly Mock<IModerationService> _serviceMock = new();
        private readonly ModerationController _controller;

        public ModerationControllerTests()
        {
            _controller = new ModerationController(_serviceMock.Object);
        }

        [Fact]
        public async Task Action_ServiceReturnsOk_Returns200Ok()
        {
            var request = new ModerationActionRequest { ContentType = "rating", ContentId = 1, Action = "approve" };
            _serviceMock.Setup(s => s.TakeAction(request))
                .ReturnsAsync(new Result<bool, string>.Ok(true));

            var result = await _controller.Action(request);

            result.Should().BeOfType<OkObjectResult>();
        }

        [Fact]
        public async Task Action_ServiceReturnsErr_Returns400BadRequest()
        {
            var request = new ModerationActionRequest { ContentType = "rating", ContentId = 1, Action = "invalid" };
            _serviceMock.Setup(s => s.TakeAction(request))
                .ReturnsAsync(new Result<bool, string>.Err("Invalid action"));

            var result = await _controller.Action(request);

            var badRequest = result.Should().BeOfType<BadRequestObjectResult>().Subject;
            badRequest.Value.Should().Be("Invalid action");
        }

        [Fact]
        public async Task Queue_ReturnsOkWithServiceList()
        {
            var queue = new List<FlaggedContentViewModel>
            {
                new() { Id = "rating:1", ContentType = "rating", Status = "pending" },
                new() { Id = "rating:2", ContentType = "rating", Status = "pending" }
            };
            _serviceMock.Setup(s => s.GetQueue("pending", null, 1, 20))
                .ReturnsAsync(queue);

            var result = await _controller.Queue("pending", null, 1);

            var ok = result.Should().BeOfType<OkObjectResult>().Subject;
            ok.Value.Should().BeSameAs(queue);
        }

        [Fact]
        public async Task Stats_ReturnsOkWithStats()
        {
            var stats = new ModerationStatsViewModel { QueueSize = 5, ActionsToday = 2, ActionsThisWeek = 10, ActionsThisMonth = 40 };
            _serviceMock.Setup(s => s.GetStats()).ReturnsAsync(stats);

            var result = await _controller.Stats();

            var ok = result.Should().BeOfType<OkObjectResult>().Subject;
            ok.Value.Should().BeSameAs(stats);
        }
    }
}

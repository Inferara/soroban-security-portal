using Microsoft.AspNetCore.Mvc;
using Moq;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Controllers;
using SorobanSecurityPortalApi.Models.ViewModels;
using SorobanSecurityPortalApi.Services.ControllersServices;
using Xunit;
using FluentAssertions;

namespace SorobanSecurityPortalApi.Tests.Controllers;

public class AgentRunsControllerTests
{
    private readonly Mock<IAgentRunService> _service = new();
    private AgentRunsController Controller() => new(_service.Object);

    [Fact]
    public async Task Enqueue_Ok_Returns_Ok()
    {
        _service.Setup(s => s.Enqueue(It.IsAny<EnqueueAgentRunViewModel>()))
            .ReturnsAsync(new Result<AgentRunViewModel, string>.Ok(new AgentRunViewModel { Id = 1 }));

        var result = await Controller().Enqueue(new EnqueueAgentRunViewModel { SourceUrl = "https://x" });

        result.Should().BeOfType<OkObjectResult>();
    }

    [Fact]
    public async Task Enqueue_Err_Returns_BadRequest()
    {
        _service.Setup(s => s.Enqueue(It.IsAny<EnqueueAgentRunViewModel>()))
            .ReturnsAsync(new Result<AgentRunViewModel, string>.Err("bad"));

        (await Controller().Enqueue(new EnqueueAgentRunViewModel())).Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task Get_Existing_Returns_Ok()
    {
        _service.Setup(s => s.Get(3)).ReturnsAsync(new AgentRunViewModel { Id = 3 });
        (await Controller().Get(3)).Should().BeOfType<OkObjectResult>();
    }

    [Fact]
    public async Task Get_Missing_Returns_NotFound()
    {
        _service.Setup(s => s.Get(404)).ReturnsAsync((AgentRunViewModel?)null);
        (await Controller().Get(404)).Should().BeOfType<NotFoundResult>();
    }

    [Fact]
    public async Task Approve_Ok_Returns_Ok()
    {
        _service.Setup(s => s.Approve(5)).ReturnsAsync(new Result<bool, string>.Ok(true));
        (await Controller().Approve(5)).Should().BeOfType<OkResult>();
    }

    [Fact]
    public async Task Approve_Err_Returns_BadRequest()
    {
        _service.Setup(s => s.Approve(5)).ReturnsAsync(new Result<bool, string>.Err("nope"));
        (await Controller().Approve(5)).Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task ClaimNext_With_Run_Returns_Ok_With_Run()
    {
        _service.Setup(s => s.ClaimNext()).ReturnsAsync(new AgentRunViewModel { Id = 7 });
        (await Controller().ClaimNext()).Should().BeOfType<OkObjectResult>();
    }

    [Fact]
    public async Task ClaimNext_With_No_Run_Returns_NoContent()
    {
        _service.Setup(s => s.ClaimNext()).ReturnsAsync((AgentRunViewModel?)null);
        (await Controller().ClaimNext()).Should().BeOfType<NoContentResult>();
    }

    [Fact]
    public async Task SubmitResult_Ok_Returns_Ok()
    {
        _service.Setup(s => s.SubmitResult(7, It.IsAny<SubmitAgentRunResultViewModel>()))
            .ReturnsAsync(new Result<bool, string>.Ok(true));
        (await Controller().SubmitResult(7, new SubmitAgentRunResultViewModel { Success = true }))
            .Should().BeOfType<OkResult>();
    }

    [Fact]
    public async Task List_Returns_Ok()
    {
        _service.Setup(s => s.List(1, 20)).ReturnsAsync(new AgentRunListResultViewModel { Total = 0 });
        (await Controller().List(1, 20)).Should().BeOfType<OkObjectResult>();
    }

    [Fact]
    public async Task Rerun_Ok_Returns_Ok_With_Payload()
    {
        _service.Setup(s => s.Rerun(8))
            .ReturnsAsync(new Result<AgentRunViewModel, string>.Ok(new AgentRunViewModel { Id = 9 }));
        var result = await Controller().Rerun(8);
        result.Should().BeOfType<OkObjectResult>();
        ((OkObjectResult)result).Value.Should().BeOfType<AgentRunViewModel>().Which.Id.Should().Be(9);
    }

    [Fact]
    public async Task Rerun_Err_Returns_BadRequest()
    {
        _service.Setup(s => s.Rerun(404))
            .ReturnsAsync(new Result<AgentRunViewModel, string>.Err("missing"));
        (await Controller().Rerun(404)).Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task SubmitResult_Err_Returns_BadRequest()
    {
        _service.Setup(s => s.SubmitResult(404, It.IsAny<SubmitAgentRunResultViewModel>()))
            .ReturnsAsync(new Result<bool, string>.Err("missing"));
        (await Controller().SubmitResult(404, new SubmitAgentRunResultViewModel { Success = false }))
            .Should().BeOfType<BadRequestObjectResult>();
    }
}

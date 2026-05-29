using System.Collections.Generic;
using System.Threading.Tasks;
using AutoMapper;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.Mapping;
using SorobanSecurityPortalApi.Models.ViewModels;
using SorobanSecurityPortalApi.Services.ControllersServices;
using Xunit;

namespace SorobanSecurityPortalApi.Tests.Services
{
    public class AgentRunServiceTests
    {
        private static IMapper BuildMapper()
        {
            var cfg = new MapperConfiguration(c => c.AddProfile<AgentRunModelProfile>(), NullLoggerFactory.Instance);
            return cfg.CreateMapper();
        }

        private static AgentRunService BuildService(
            Mock<IAgentRunProcessor> runProc,
            Mock<IReportProcessor>? reportProc = null,
            Mock<IVulnerabilityProcessor>? vulnProc = null)
        {
            var userCtx = new Mock<IUserContextAccessor>();
            userCtx.Setup(u => u.GetLoginIdAsync()).ReturnsAsync(99);
            return new AgentRunService(
                BuildMapper(),
                runProc.Object,
                (reportProc ?? new Mock<IReportProcessor>()).Object,
                (vulnProc ?? new Mock<IVulnerabilityProcessor>()).Object,
                userCtx.Object);
        }

        [Fact]
        public async Task Enqueue_With_SourceUrl_Creates_Queued_Run()
        {
            var runProc = new Mock<IAgentRunProcessor>();
            runProc.Setup(p => p.Add(It.IsAny<AgentRunModel>()))
                .ReturnsAsync((AgentRunModel m) => { m.Id = 1; return m; });
            var svc = BuildService(runProc);

            var result = await svc.Enqueue(new EnqueueAgentRunViewModel { SourceUrl = "https://x/report" });

            result.Should().BeOfType<Result<AgentRunViewModel, string>.Ok>();
            runProc.Verify(p => p.Add(It.Is<AgentRunModel>(m =>
                m.SourceUrl == "https://x/report" && m.CreatedBy == 99)), Times.Once);
        }

        [Fact]
        public async Task Enqueue_With_Neither_SourceUrl_Nor_ReportId_Returns_Err()
        {
            var svc = BuildService(new Mock<IAgentRunProcessor>());

            var result = await svc.Enqueue(new EnqueueAgentRunViewModel());

            result.Should().BeOfType<Result<AgentRunViewModel, string>.Err>();
        }

        [Fact]
        public async Task Get_Parses_FindingsJson_Into_Findings()
        {
            var runProc = new Mock<IAgentRunProcessor>();
            runProc.Setup(p => p.Get(3)).ReturnsAsync(new AgentRunModel
            {
                Id = 3, Status = AgentRunStatus.Succeeded,
                FindingsJson = "[{\"Title\":\"Reentrancy\",\"Severity\":\"high\",\"Tags\":[\"x\"],\"Category\":0}]"
            });
            var svc = BuildService(runProc);

            var vm = await svc.Get(3);

            vm!.Findings.Should().ContainSingle();
            vm.Findings[0].Title.Should().Be("Reentrancy");
            vm.Findings[0].Severity.Should().Be("high");
        }

        [Fact]
        public async Task Get_With_Empty_FindingsJson_Returns_Empty_Findings()
        {
            var runProc = new Mock<IAgentRunProcessor>();
            runProc.Setup(p => p.Get(4)).ReturnsAsync(new AgentRunModel { Id = 4, FindingsJson = "" });
            var svc = BuildService(runProc);

            (await svc.Get(4))!.Findings.Should().BeEmpty();
        }

        [Fact]
        public async Task Rerun_Of_Existing_Run_Enqueues_New_Run_With_Same_Input()
        {
            var runProc = new Mock<IAgentRunProcessor>();
            runProc.Setup(p => p.Get(8)).ReturnsAsync(new AgentRunModel
            { Id = 8, SourceUrl = "https://x/r", ReportId = null, Model = "claude" });
            runProc.Setup(p => p.Add(It.IsAny<AgentRunModel>()))
                .ReturnsAsync((AgentRunModel m) => { m.Id = 9; return m; });
            var svc = BuildService(runProc);

            var result = await svc.Rerun(8);

            result.Should().BeOfType<Result<AgentRunViewModel, string>.Ok>();
            runProc.Verify(p => p.Add(It.Is<AgentRunModel>(m =>
                m.SourceUrl == "https://x/r" && m.Model == "claude")), Times.Once);
        }

        [Fact]
        public async Task Rerun_Of_Missing_Run_Returns_Err()
        {
            var runProc = new Mock<IAgentRunProcessor>();
            runProc.Setup(p => p.Get(404)).ReturnsAsync((AgentRunModel?)null);
            var svc = BuildService(runProc);

            (await svc.Rerun(404)).Should().BeOfType<Result<AgentRunViewModel, string>.Err>();
        }
    }
}

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

        [Fact]
        public async Task List_Returns_Items_And_Total()
        {
            var runProc = new Mock<IAgentRunProcessor>();
            runProc.Setup(p => p.GetList(1, 20)).ReturnsAsync(new List<AgentRunModel>
            {
                new() { Id = 1, Status = AgentRunStatus.Queued },
                new() { Id = 2, Status = AgentRunStatus.Succeeded },
            });
            runProc.Setup(p => p.GetListTotal()).ReturnsAsync(2);
            var svc = BuildService(runProc);

            var result = await svc.List(1, 20);

            result.Items.Should().HaveCount(2);
            result.Total.Should().Be(2);
        }

        [Fact]
        public async Task ClaimNext_Returns_Null_When_Nothing_Queued()
        {
            var runProc = new Mock<IAgentRunProcessor>();
            runProc.Setup(p => p.ClaimNextQueued()).ReturnsAsync((AgentRunModel?)null);
            var svc = BuildService(runProc);

            (await svc.ClaimNext()).Should().BeNull();
        }

        [Fact]
        public async Task SubmitResult_For_Missing_Run_Returns_Err()
        {
            var runProc = new Mock<IAgentRunProcessor>();
            runProc.Setup(p => p.Get(404)).ReturnsAsync((AgentRunModel?)null);
            var svc = BuildService(runProc);

            (await svc.SubmitResult(404, new SubmitAgentRunResultViewModel { Success = true }))
                .Should().BeOfType<Result<bool, string>.Err>();
        }

        [Fact]
        public async Task Approve_Succeeded_Run_Creates_Report_And_Vulnerabilities_In_New_Status()
        {
            var runProc = new Mock<IAgentRunProcessor>();
            runProc.Setup(p => p.Get(10)).ReturnsAsync(new AgentRunModel
            {
                Id = 10, Status = AgentRunStatus.Succeeded, SourceUrl = "https://x/r",
                ArticleMarkdown = "# Audit of X",
                FindingsJson = "[{\"Title\":\"Bug A\",\"Description\":\"d\",\"Severity\":\"high\",\"Tags\":[\"t\"],\"Category\":0}]"
            });
            var reportProc = new Mock<IReportProcessor>();
            reportProc.Setup(p => p.Add(It.IsAny<ReportModel>()))
                .ReturnsAsync((ReportModel r) => { r.Id = 55; return r; });
            var vulnProc = new Mock<IVulnerabilityProcessor>();
            vulnProc.Setup(p => p.Add(It.IsAny<VulnerabilityModel>()))
                .ReturnsAsync((VulnerabilityModel v) => { v.Id = 200; return v; });
            var svc = BuildService(runProc, reportProc, vulnProc);

            var result = await svc.Approve(10);

            result.Should().BeOfType<Result<bool, string>.Ok>();
            reportProc.Verify(p => p.Add(It.Is<ReportModel>(r =>
                r.MdFile == "# Audit of X" && r.Status == ReportModelStatus.New && r.CreatedBy == 99)), Times.Once);
            vulnProc.Verify(p => p.Add(It.Is<VulnerabilityModel>(v =>
                v.Title == "Bug A" && v.Severity == "high" && v.ReportId == 55 && v.CreatedBy == 99)), Times.Once);
            runProc.Verify(p => p.SetProvenance(10, 55, It.Is<List<int>>(l => l.Contains(200))), Times.Once);
            runProc.Verify(p => p.SetStatus(10, AgentRunStatus.Approved), Times.Once);
        }

        [Fact]
        public async Task Approve_NonSucceeded_Run_Returns_Err()
        {
            var runProc = new Mock<IAgentRunProcessor>();
            runProc.Setup(p => p.Get(11)).ReturnsAsync(new AgentRunModel { Id = 11, Status = AgentRunStatus.Queued });
            var svc = BuildService(runProc);

            (await svc.Approve(11)).Should().BeOfType<Result<bool, string>.Err>();
        }

        [Fact]
        public async Task Approve_Already_Approved_Run_Returns_Err()
        {
            var runProc = new Mock<IAgentRunProcessor>();
            runProc.Setup(p => p.Get(12)).ReturnsAsync(new AgentRunModel { Id = 12, Status = AgentRunStatus.Approved });
            var svc = BuildService(runProc);

            (await svc.Approve(12)).Should().BeOfType<Result<bool, string>.Err>();
        }

        [Fact]
        public async Task Approve_Run_Against_Existing_Report_Does_Not_Create_New_Report()
        {
            var runProc = new Mock<IAgentRunProcessor>();
            runProc.Setup(p => p.Get(13)).ReturnsAsync(new AgentRunModel
            {
                Id = 13, Status = AgentRunStatus.Succeeded, ReportId = 77,
                FindingsJson = "[{\"Title\":\"Bug\",\"Severity\":\"low\",\"Tags\":[],\"Category\":0}]"
            });
            var reportProc = new Mock<IReportProcessor>();
            var vulnProc = new Mock<IVulnerabilityProcessor>();
            vulnProc.Setup(p => p.Add(It.IsAny<VulnerabilityModel>()))
                .ReturnsAsync((VulnerabilityModel v) => { v.Id = 201; return v; });
            var svc = BuildService(runProc, reportProc, vulnProc);

            var result = await svc.Approve(13);

            result.Should().BeOfType<Result<bool, string>.Ok>();
            reportProc.Verify(p => p.Add(It.IsAny<ReportModel>()), Times.Never);
            vulnProc.Verify(p => p.Add(It.Is<VulnerabilityModel>(v => v.ReportId == 77)), Times.Once);
            runProc.Verify(p => p.SetProvenance(13, 77, It.IsAny<List<int>>()), Times.Once);
        }

        [Fact]
        public async Task Reject_Succeeded_Run_Sets_Rejected()
        {
            var runProc = new Mock<IAgentRunProcessor>();
            runProc.Setup(p => p.Get(14)).ReturnsAsync(new AgentRunModel { Id = 14, Status = AgentRunStatus.Succeeded });
            var svc = BuildService(runProc);

            (await svc.Reject(14)).Should().BeOfType<Result<bool, string>.Ok>();
            runProc.Verify(p => p.SetStatus(14, AgentRunStatus.Rejected), Times.Once);
        }
    }
}

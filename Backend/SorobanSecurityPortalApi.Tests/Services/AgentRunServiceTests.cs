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
            Mock<IVulnerabilityProcessor>? vulnProc = null,
            Mock<IProtocolProcessor>? protocolProc = null,
            Mock<IAuditorProcessor>? auditorProc = null)
        {
            var userCtx = new Mock<IUserContextAccessor>();
            userCtx.Setup(u => u.GetLoginIdAsync()).ReturnsAsync(99);
            return new AgentRunService(
                BuildMapper(),
                runProc.Object,
                (reportProc ?? new Mock<IReportProcessor>()).Object,
                (vulnProc ?? new Mock<IVulnerabilityProcessor>()).Object,
                (protocolProc ?? new Mock<IProtocolProcessor>()).Object,
                (auditorProc ?? new Mock<IAuditorProcessor>()).Object,
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

        private static ApproveAgentRunViewModel Payload(params AgentFinding[] findings) => new()
        {
            ReportTitle = "Rozo Audit", ProtocolName = "Rozo", AuditorName = "Hacken",
            ArticleMarkdown = "# Audit", Findings = findings.ToList()
        };

        [Fact]
        public async Task Approve_Creates_Report_With_Article_And_Selected_Findings()
        {
            var runProc = new Mock<IAgentRunProcessor>();
            runProc.Setup(p => p.Get(10)).ReturnsAsync(new AgentRunModel { Id = 10, Status = AgentRunStatus.Succeeded });
            var reportProc = new Mock<IReportProcessor>();
            reportProc.Setup(p => p.Add(It.IsAny<ReportModel>())).ReturnsAsync((ReportModel r) => { r.Id = 55; return r; });
            var vulnProc = new Mock<IVulnerabilityProcessor>();
            vulnProc.Setup(p => p.Add(It.IsAny<VulnerabilityModel>())).ReturnsAsync((VulnerabilityModel v) => { v.Id = 200; return v; });
            var protoProc = new Mock<IProtocolProcessor>();
            protoProc.Setup(p => p.List()).ReturnsAsync(new List<ProtocolModel>());
            protoProc.Setup(p => p.Add(It.IsAny<ProtocolModel>())).ReturnsAsync((ProtocolModel p) => { p.Id = 7; return p; });
            var audProc = new Mock<IAuditorProcessor>();
            audProc.Setup(a => a.List()).ReturnsAsync(new List<AuditorModel>());
            audProc.Setup(a => a.Add(It.IsAny<AuditorModel>())).ReturnsAsync((AuditorModel a) => { a.Id = 9; return a; });
            var svc = BuildService(runProc, reportProc, vulnProc, protoProc, audProc);

            var payload = Payload(
                new AgentFinding { Title = "Bug A", Description = "d", Severity = "high", Tags = new() { "t" }, Category = VulnerabilityCategory.Valid },
                new AgentFinding { Title = "Bug B", Description = "d2", Severity = "low", Tags = new(), Category = VulnerabilityCategory.Valid });
            var result = await svc.Approve(10, payload);

            result.Should().BeOfType<Result<bool, string>.Ok>();
            reportProc.Verify(p => p.Add(It.Is<ReportModel>(r =>
                r.Name == "Rozo Audit" && r.MdFile == "# Audit" && r.Status == ReportModelStatus.New &&
                r.ProtocolId == 7 && r.AuditorId == 9 && r.CreatedBy == 99)), Times.Once);
            vulnProc.Verify(p => p.Add(It.IsAny<VulnerabilityModel>()), Times.Exactly(2));
            vulnProc.Verify(p => p.Add(It.Is<VulnerabilityModel>(v => v.Title == "Bug A" && v.Severity == "high" && v.ReportId == 55)), Times.Once);
            runProc.Verify(p => p.SetStatus(10, AgentRunStatus.Approved), Times.Once);
        }

        [Fact]
        public async Task Approve_Creates_New_Auditor_And_Protocol_When_Names_Are_New()
        {
            var runProc = new Mock<IAgentRunProcessor>();
            runProc.Setup(p => p.Get(11)).ReturnsAsync(new AgentRunModel { Id = 11, Status = AgentRunStatus.Succeeded });
            var reportProc = new Mock<IReportProcessor>();
            reportProc.Setup(p => p.Add(It.IsAny<ReportModel>())).ReturnsAsync((ReportModel r) => { r.Id = 1; return r; });
            var protoProc = new Mock<IProtocolProcessor>();
            protoProc.Setup(p => p.List()).ReturnsAsync(new List<ProtocolModel>());
            protoProc.Setup(p => p.Add(It.IsAny<ProtocolModel>())).ReturnsAsync((ProtocolModel p) => { p.Id = 7; return p; });
            var audProc = new Mock<IAuditorProcessor>();
            audProc.Setup(a => a.List()).ReturnsAsync(new List<AuditorModel>());
            audProc.Setup(a => a.Add(It.IsAny<AuditorModel>())).ReturnsAsync((AuditorModel a) => { a.Id = 9; return a; });
            var svc = BuildService(runProc, reportProc, vulnProc: null, protoProc, audProc);

            await svc.Approve(11, Payload());

            protoProc.Verify(p => p.Add(It.Is<ProtocolModel>(x => x.Name == "Rozo")), Times.Once);
            audProc.Verify(a => a.Add(It.Is<AuditorModel>(x => x.Name == "Hacken")), Times.Once);
        }

        [Fact]
        public async Task Approve_Reuses_Existing_Auditor_And_Protocol_CaseInsensitive()
        {
            var runProc = new Mock<IAgentRunProcessor>();
            runProc.Setup(p => p.Get(12)).ReturnsAsync(new AgentRunModel { Id = 12, Status = AgentRunStatus.Succeeded });
            var reportProc = new Mock<IReportProcessor>();
            reportProc.Setup(p => p.Add(It.IsAny<ReportModel>())).ReturnsAsync((ReportModel r) => { r.Id = 1; return r; });
            var protoProc = new Mock<IProtocolProcessor>();
            protoProc.Setup(p => p.List()).ReturnsAsync(new List<ProtocolModel> { new() { Id = 3, Name = "Rozo" } });
            var audProc = new Mock<IAuditorProcessor>();
            audProc.Setup(a => a.List()).ReturnsAsync(new List<AuditorModel> { new() { Id = 4, Name = "Hacken" } });
            var svc = BuildService(runProc, reportProc, null, protoProc, audProc);

            var payload = new ApproveAgentRunViewModel { ReportTitle = "T", ProtocolName = "rozo", AuditorName = "HACKEN", Findings = new() };
            await svc.Approve(12, payload);

            protoProc.Verify(p => p.Add(It.IsAny<ProtocolModel>()), Times.Never);
            audProc.Verify(a => a.Add(It.IsAny<AuditorModel>()), Times.Never);
            reportProc.Verify(p => p.Add(It.Is<ReportModel>(r => r.ProtocolId == 3 && r.AuditorId == 4)), Times.Once);
        }

        [Fact]
        public async Task Approve_Blank_Names_Leave_Protocol_Auditor_Null()
        {
            var runProc = new Mock<IAgentRunProcessor>();
            runProc.Setup(p => p.Get(13)).ReturnsAsync(new AgentRunModel { Id = 13, Status = AgentRunStatus.Succeeded });
            var reportProc = new Mock<IReportProcessor>();
            reportProc.Setup(p => p.Add(It.IsAny<ReportModel>())).ReturnsAsync((ReportModel r) => { r.Id = 1; return r; });
            var protoProc = new Mock<IProtocolProcessor>();
            var audProc = new Mock<IAuditorProcessor>();
            var svc = BuildService(runProc, reportProc, null, protoProc, audProc);

            await svc.Approve(13, new ApproveAgentRunViewModel { ReportTitle = "T", Findings = new() });

            protoProc.Verify(p => p.List(), Times.Never);
            audProc.Verify(a => a.List(), Times.Never);
            reportProc.Verify(p => p.Add(It.Is<ReportModel>(r => r.ProtocolId == null && r.AuditorId == null)), Times.Once);
        }

        [Fact]
        public async Task Approve_NonSucceeded_Returns_Err()
        {
            var runProc = new Mock<IAgentRunProcessor>();
            runProc.Setup(p => p.Get(14)).ReturnsAsync(new AgentRunModel { Id = 14, Status = AgentRunStatus.Queued });
            (await BuildService(runProc).Approve(14, Payload())).Should().BeOfType<Result<bool, string>.Err>();
        }

        [Fact]
        public async Task Approve_Missing_Run_Returns_Err()
        {
            var runProc = new Mock<IAgentRunProcessor>();
            runProc.Setup(p => p.Get(404)).ReturnsAsync((AgentRunModel?)null);
            (await BuildService(runProc).Approve(404, Payload())).Should().BeOfType<Result<bool, string>.Err>();
        }

        [Fact]
        public async Task Approve_Run_Against_Existing_Report_Reuses_It()
        {
            var runProc = new Mock<IAgentRunProcessor>();
            runProc.Setup(p => p.Get(15)).ReturnsAsync(new AgentRunModel { Id = 15, Status = AgentRunStatus.Succeeded, ReportId = 77 });
            var reportProc = new Mock<IReportProcessor>();
            var vulnProc = new Mock<IVulnerabilityProcessor>();
            vulnProc.Setup(p => p.Add(It.IsAny<VulnerabilityModel>())).ReturnsAsync((VulnerabilityModel v) => { v.Id = 1; return v; });
            var svc = BuildService(runProc, reportProc, vulnProc);

            await svc.Approve(15, Payload(new AgentFinding { Title = "X", Severity = "low", Tags = new(), Category = VulnerabilityCategory.Valid }));

            reportProc.Verify(p => p.Add(It.IsAny<ReportModel>()), Times.Never);
            vulnProc.Verify(p => p.Add(It.Is<VulnerabilityModel>(v => v.ReportId == 77)), Times.Once);
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

        [Fact]
        public async Task Reject_Missing_Run_Returns_Err()
        {
            var runProc = new Mock<IAgentRunProcessor>();
            runProc.Setup(p => p.Get(404)).ReturnsAsync((AgentRunModel?)null);
            var svc = BuildService(runProc);

            (await svc.Reject(404)).Should().BeOfType<Result<bool, string>.Err>();
        }

        [Fact]
        public async Task Reject_Approved_Run_Returns_Err_And_Does_Not_Touch_Status()
        {
            var runProc = new Mock<IAgentRunProcessor>();
            runProc.Setup(p => p.Get(20)).ReturnsAsync(new AgentRunModel { Id = 20, Status = AgentRunStatus.Approved });
            var svc = BuildService(runProc);

            (await svc.Reject(20)).Should().BeOfType<Result<bool, string>.Err>();
            runProc.Verify(p => p.SetStatus(It.IsAny<int>(), It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task Reject_Failed_Run_Sets_Rejected()
        {
            var runProc = new Mock<IAgentRunProcessor>();
            runProc.Setup(p => p.Get(21)).ReturnsAsync(new AgentRunModel { Id = 21, Status = AgentRunStatus.Failed });
            var svc = BuildService(runProc);

            (await svc.Reject(21)).Should().BeOfType<Result<bool, string>.Ok>();
            runProc.Verify(p => p.SetStatus(21, AgentRunStatus.Rejected), Times.Once);
        }

        [Fact]
        public async Task Get_Parses_String_Category_And_Severity_In_Findings()
        {
            var runProc = new Mock<IAgentRunProcessor>();
            runProc.Setup(p => p.Get(30)).ReturnsAsync(new AgentRunModel
            {
                Id = 30, Status = AgentRunStatus.Succeeded,
                FindingsJson = "[{\"Title\":\"X\",\"Severity\":\"medium\",\"Tags\":[],\"Category\":\"ValidNotFixed\"}]"
            });
            var svc = BuildService(runProc);

            var vm = await svc.Get(30);

            vm!.Findings.Should().ContainSingle();
            vm.Findings[0].Category.Should().Be(VulnerabilityCategory.ValidNotFixed);
            vm.Findings[0].Severity.Should().Be("medium");
        }

        [Fact]
        public async Task Get_Malformed_FindingsJson_Sets_FindingsUnparseable_True()
        {
            var runProc = new Mock<IAgentRunProcessor>();
            runProc.Setup(p => p.Get(40)).ReturnsAsync(new AgentRunModel
            { Id = 40, Status = AgentRunStatus.Succeeded, FindingsJson = "{not valid json" });
            var svc = BuildService(runProc);

            var vm = await svc.Get(40);

            vm!.FindingsUnparseable.Should().BeTrue();
            vm.Findings.Should().BeEmpty();
        }

        [Fact]
        public async Task Get_Valid_Empty_Array_Is_Not_Unparseable()
        {
            var runProc = new Mock<IAgentRunProcessor>();
            runProc.Setup(p => p.Get(41)).ReturnsAsync(new AgentRunModel
            { Id = 41, Status = AgentRunStatus.Succeeded, FindingsJson = "[]" });
            var svc = BuildService(runProc);

            var vm = await svc.Get(41);

            vm!.FindingsUnparseable.Should().BeFalse();
            vm.Findings.Should().BeEmpty();
        }

        [Fact]
        public async Task Get_Empty_FindingsJson_Is_Not_Unparseable()
        {
            var runProc = new Mock<IAgentRunProcessor>();
            runProc.Setup(p => p.Get(42)).ReturnsAsync(new AgentRunModel
            { Id = 42, Status = AgentRunStatus.Succeeded, FindingsJson = "" });
            var svc = BuildService(runProc);

            (await svc.Get(42))!.FindingsUnparseable.Should().BeFalse();
        }

        [Fact]
        public async Task Get_Returns_Report_Metadata()
        {
            var runProc = new Mock<IAgentRunProcessor>();
            runProc.Setup(p => p.Get(60)).ReturnsAsync(new AgentRunModel
            {
                Id = 60, Status = AgentRunStatus.Succeeded,
                ReportTitle = "Rozo Audit", ProtocolName = "Rozo", AuditorName = "Hacken"
            });
            var svc = BuildService(runProc);

            var vm = await svc.Get(60);

            vm!.ReportTitle.Should().Be("Rozo Audit");
            vm.ProtocolName.Should().Be("Rozo");
            vm.AuditorName.Should().Be("Hacken");
        }
    }
}

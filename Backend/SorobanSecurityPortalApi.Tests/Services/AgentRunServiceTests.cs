using System.Collections.Generic;
using System.Net.Http;
using System.Threading;
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
            Mock<IAuditorProcessor>? auditorProc = null,
            Mock<IHttpClientFactory>? httpFactory = null)
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
                (httpFactory ?? new Mock<IHttpClientFactory>()).Object,
                userCtx.Object);
        }

        private static Mock<IHttpClientFactory> HttpFactoryReturning(byte[] body)
        {
            var handler = new StubHandler(body);
            var client = new HttpClient(handler);
            var f = new Mock<IHttpClientFactory>();
            f.Setup(x => x.CreateClient(It.IsAny<string>())).Returns(client);
            return f;
        }

        private sealed class StubHandler : HttpMessageHandler
        {
            private readonly byte[] _body;
            public StubHandler(byte[] body) { _body = body; }
            protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
                => Task.FromResult(new HttpResponseMessage(System.Net.HttpStatusCode.OK) { Content = new ByteArrayContent(_body) });
        }

        private static Mock<IHttpClientFactory> HttpFactoryWith(HttpMessageHandler handler)
        {
            var client = new HttpClient(handler);
            var f = new Mock<IHttpClientFactory>();
            f.Setup(x => x.CreateClient(It.IsAny<string>())).Returns(client);
            return f;
        }

        // Throws a transient network fault on the first (failBeforeSuccess) calls, then returns the body.
        private sealed class FlakyHandler : HttpMessageHandler
        {
            private readonly byte[] _body;
            private int _calls;
            private readonly int _failBeforeSuccess;
            public int Calls => _calls;
            public FlakyHandler(byte[] body, int failBeforeSuccess) { _body = body; _failBeforeSuccess = failBeforeSuccess; }
            protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
            {
                _calls++;
                if (_calls <= _failBeforeSuccess)
                    throw new HttpRequestException("simulated transient connection reset");
                return Task.FromResult(new HttpResponseMessage(System.Net.HttpStatusCode.OK) { Content = new ByteArrayContent(_body) });
            }
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
                m.SourceUrl == "https://x/report" && m.CreatedBy == 99
                && m.Model == "zai-coding-plan/glm-5.1")), Times.Once); // defaults model when not specified
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
        public async Task GetExamples_Returns_Approved_Articles_Vulns_And_Titles()
        {
            var reportProc = new Mock<IReportProcessor>();
            reportProc.Setup(p => p.GetListForExamples()).ReturnsAsync(new List<ReportModel>
            {
                new() { Id = 1, Name = "Report A", Status = ReportModelStatus.Approved, MdFile = "# A" },
                new() { Id = 2, Name = "Report B", Status = ReportModelStatus.New,      MdFile = "# B" },
                new() { Id = 3, Name = "Report C", Status = ReportModelStatus.Approved, MdFile = "" },
            });
            var vulnProc = new Mock<IVulnerabilityProcessor>();
            vulnProc.Setup(p => p.GetList()).ReturnsAsync(new List<VulnerabilityModel>
            {
                new() { Id = 10, Title = "Reentrancy", Severity = "high", Status = VulnerabilityModelStatus.Approved, Category = VulnerabilityCategory.Valid, Tags = new() { "defi" }, Description = "desc1" },
                new() { Id = 11, Title = "Overflow",   Severity = "low",  Status = VulnerabilityModelStatus.New,      Category = VulnerabilityCategory.Valid, Tags = new(), Description = "desc2" },
                new() { Id = 12, Title = "Logic Bug",  Severity = "med",  Status = VulnerabilityModelStatus.Approved, Category = VulnerabilityCategory.ValidNotFixed, Tags = null, Description = "desc3" },
            });
            var svc = BuildService(new Mock<IAgentRunProcessor>(), reportProc, vulnProc);

            var result = await svc.GetExamples();

            // Only approved reports with non-empty MdFile
            result.Articles.Should().ContainSingle()
                .Which.Title.Should().Be("Report A");
            result.Articles[0].Markdown.Should().Be("# A");

            // Only approved vulns
            result.Vulnerabilities.Should().HaveCount(2);
            result.Vulnerabilities.Should().OnlyContain(v => v.Title == "Reentrancy" || v.Title == "Logic Bug");

            // All approved titles
            result.ExistingFindingTitles.Should().BeEquivalentTo(new[] { "Reentrancy", "Logic Bug" });
        }

        [Fact]
        public async Task UpdateProgress_Missing_Run_Returns_Err()
        {
            var runProc = new Mock<IAgentRunProcessor>();
            runProc.Setup(p => p.Get(404)).ReturnsAsync((AgentRunModel?)null);
            var svc = BuildService(runProc);

            (await svc.UpdateProgress(404, "some transcript"))
                .Should().BeOfType<Result<bool, string>.Err>();
        }

        [Fact]
        public async Task UpdateProgress_Existing_Calls_UpdateTranscript()
        {
            var runProc = new Mock<IAgentRunProcessor>();
            runProc.Setup(p => p.Get(5)).ReturnsAsync(new AgentRunModel { Id = 5, Status = AgentRunStatus.Processing });
            var svc = BuildService(runProc);

            var result = await svc.UpdateProgress(5, "trace here");

            result.Should().BeOfType<Result<bool, string>.Ok>();
            runProc.Verify(p => p.UpdateTranscript(5, "trace here"), Times.Once);
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

        [Fact]
        public async Task Approve_With_Valid_PdfUrl_Sets_BinFile()
        {
            var pdfBytes = System.Text.Encoding.ASCII.GetBytes("%PDF-1.4\n%test");
            var httpFactory = HttpFactoryReturning(pdfBytes);

            var runProc = new Mock<IAgentRunProcessor>();
            runProc.Setup(p => p.Get(70)).ReturnsAsync(new AgentRunModel { Id = 70, Status = AgentRunStatus.Succeeded });
            var reportProc = new Mock<IReportProcessor>();
            reportProc.Setup(p => p.Add(It.IsAny<ReportModel>())).ReturnsAsync((ReportModel r) => { r.Id = 100; return r; });
            var protoProc = new Mock<IProtocolProcessor>();
            protoProc.Setup(p => p.List()).ReturnsAsync(new List<ProtocolModel>());
            protoProc.Setup(p => p.Add(It.IsAny<ProtocolModel>())).ReturnsAsync((ProtocolModel p) => { p.Id = 1; return p; });
            var audProc = new Mock<IAuditorProcessor>();
            audProc.Setup(a => a.List()).ReturnsAsync(new List<AuditorModel>());
            audProc.Setup(a => a.Add(It.IsAny<AuditorModel>())).ReturnsAsync((AuditorModel a) => { a.Id = 2; return a; });
            var svc = BuildService(runProc, reportProc, null, protoProc, audProc, httpFactory);

            var payload = new ApproveAgentRunViewModel
            {
                ReportTitle = "Pdf Audit", ProtocolName = "Proto", AuditorName = "Aud",
                ArticleMarkdown = "<article>", Findings = new(),
                ReportPdfUrl = "https://example.com/r.pdf"
            };
            var result = await svc.Approve(70, payload);

            result.Should().BeOfType<Result<bool, string>.Ok>();
            reportProc.Verify(p => p.Add(It.Is<ReportModel>(r =>
                r.BinFile != null && r.BinFile.Length > 0 && r.MdFile == "<article>")), Times.Once);
        }

        [Fact]
        public async Task Approve_Retries_Transient_Network_Fault_Then_Sets_BinFile()
        {
            // The cluster node's egress flaps: the first two GETs throw, the third succeeds.
            // TryFetchReportPdf must retry on network faults and still populate BinFile.
            var pdfBytes = System.Text.Encoding.ASCII.GetBytes("%PDF-1.4\n%flaky");
            var handler = new FlakyHandler(pdfBytes, failBeforeSuccess: 2);
            var httpFactory = HttpFactoryWith(handler);

            var runProc = new Mock<IAgentRunProcessor>();
            runProc.Setup(p => p.Get(73)).ReturnsAsync(new AgentRunModel { Id = 73, Status = AgentRunStatus.Succeeded });
            var reportProc = new Mock<IReportProcessor>();
            reportProc.Setup(p => p.Add(It.IsAny<ReportModel>())).ReturnsAsync((ReportModel r) => { r.Id = 103; return r; });
            var protoProc = new Mock<IProtocolProcessor>();
            protoProc.Setup(p => p.List()).ReturnsAsync(new List<ProtocolModel>());
            protoProc.Setup(p => p.Add(It.IsAny<ProtocolModel>())).ReturnsAsync((ProtocolModel p) => { p.Id = 1; return p; });
            var audProc = new Mock<IAuditorProcessor>();
            audProc.Setup(a => a.List()).ReturnsAsync(new List<AuditorModel>());
            audProc.Setup(a => a.Add(It.IsAny<AuditorModel>())).ReturnsAsync((AuditorModel a) => { a.Id = 2; return a; });
            var svc = BuildService(runProc, reportProc, null, protoProc, audProc, httpFactory);

            var payload = new ApproveAgentRunViewModel
            {
                ReportTitle = "Flaky Audit", ProtocolName = "Proto", AuditorName = "Aud",
                ArticleMarkdown = "<article>", Findings = new(),
                ReportPdfUrl = "https://example.com/r.pdf"
            };
            var result = await svc.Approve(73, payload);

            result.Should().BeOfType<Result<bool, string>.Ok>();
            handler.Calls.Should().Be(3); // 2 failures + 1 success
            reportProc.Verify(p => p.Add(It.Is<ReportModel>(r =>
                r.BinFile != null && r.BinFile.Length > 0)), Times.Once);
        }

        [Fact]
        public async Task Approve_With_NonPdf_Url_Leaves_BinFile_Null_But_Succeeds()
        {
            var nonPdfBytes = System.Text.Encoding.ASCII.GetBytes("<html>not a pdf</html>");
            var httpFactory = HttpFactoryReturning(nonPdfBytes);

            var runProc = new Mock<IAgentRunProcessor>();
            runProc.Setup(p => p.Get(71)).ReturnsAsync(new AgentRunModel { Id = 71, Status = AgentRunStatus.Succeeded });
            var reportProc = new Mock<IReportProcessor>();
            reportProc.Setup(p => p.Add(It.IsAny<ReportModel>())).ReturnsAsync((ReportModel r) => { r.Id = 101; return r; });
            var protoProc = new Mock<IProtocolProcessor>();
            protoProc.Setup(p => p.List()).ReturnsAsync(new List<ProtocolModel>());
            protoProc.Setup(p => p.Add(It.IsAny<ProtocolModel>())).ReturnsAsync((ProtocolModel p) => { p.Id = 1; return p; });
            var audProc = new Mock<IAuditorProcessor>();
            audProc.Setup(a => a.List()).ReturnsAsync(new List<AuditorModel>());
            audProc.Setup(a => a.Add(It.IsAny<AuditorModel>())).ReturnsAsync((AuditorModel a) => { a.Id = 2; return a; });
            var svc = BuildService(runProc, reportProc, null, protoProc, audProc, httpFactory);

            var payload = new ApproveAgentRunViewModel
            {
                ReportTitle = "Html Audit", ProtocolName = "Proto", AuditorName = "Aud",
                ArticleMarkdown = "# Art", Findings = new(),
                ReportPdfUrl = "https://example.com/notpdf.html"
            };
            var result = await svc.Approve(71, payload);

            result.Should().BeOfType<Result<bool, string>.Ok>();
            reportProc.Verify(p => p.Add(It.Is<ReportModel>(r => r.BinFile == null)), Times.Once);
        }

        [Fact]
        public async Task Approve_With_Blank_PdfUrl_No_Fetch()
        {
            var httpFactory = new Mock<IHttpClientFactory>();

            var runProc = new Mock<IAgentRunProcessor>();
            runProc.Setup(p => p.Get(72)).ReturnsAsync(new AgentRunModel { Id = 72, Status = AgentRunStatus.Succeeded });
            var reportProc = new Mock<IReportProcessor>();
            reportProc.Setup(p => p.Add(It.IsAny<ReportModel>())).ReturnsAsync((ReportModel r) => { r.Id = 102; return r; });
            var protoProc = new Mock<IProtocolProcessor>();
            protoProc.Setup(p => p.List()).ReturnsAsync(new List<ProtocolModel>());
            protoProc.Setup(p => p.Add(It.IsAny<ProtocolModel>())).ReturnsAsync((ProtocolModel p) => { p.Id = 1; return p; });
            var audProc = new Mock<IAuditorProcessor>();
            audProc.Setup(a => a.List()).ReturnsAsync(new List<AuditorModel>());
            audProc.Setup(a => a.Add(It.IsAny<AuditorModel>())).ReturnsAsync((AuditorModel a) => { a.Id = 2; return a; });
            var svc = BuildService(runProc, reportProc, null, protoProc, audProc, httpFactory);

            var payload = new ApproveAgentRunViewModel
            {
                ReportTitle = "Blank Url Audit", ProtocolName = "Proto", AuditorName = "Aud",
                ArticleMarkdown = "# Art", Findings = new(),
                ReportPdfUrl = ""
            };
            var result = await svc.Approve(72, payload);

            result.Should().BeOfType<Result<bool, string>.Ok>();
            reportProc.Verify(p => p.Add(It.Is<ReportModel>(r => r.BinFile == null)), Times.Once);
            httpFactory.Verify(f => f.CreateClient(It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task Approve_Coerces_Unspecified_ReportDate_To_Utc_On_Report()
        {
            // The UI's date-only field yields a DateTime with Kind=Unspecified; report.Date is a
            // timestamptz column → Npgsql rejects it. Approve must coerce to UTC before saving.
            var runProc = new Mock<IAgentRunProcessor>();
            runProc.Setup(p => p.Get(80)).ReturnsAsync(new AgentRunModel { Id = 80, Status = AgentRunStatus.Succeeded });
            var reportProc = new Mock<IReportProcessor>();
            reportProc.Setup(p => p.Add(It.IsAny<ReportModel>())).ReturnsAsync((ReportModel r) => { r.Id = 1; return r; });
            var svc = BuildService(runProc, reportProc);

            var payload = new ApproveAgentRunViewModel
            {
                ReportTitle = "T", Findings = new(),
                ReportDate = new DateTime(2026, 4, 13, 0, 0, 0, DateTimeKind.Unspecified)
            };
            (await svc.Approve(80, payload)).Should().BeOfType<Result<bool, string>.Ok>();

            reportProc.Verify(p => p.Add(It.Is<ReportModel>(r => r.Date.Kind == DateTimeKind.Utc)), Times.Once);
        }
    }
}

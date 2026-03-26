using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using AutoMapper;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Moq;
using SorobanSecurityPortalApi.Authorization;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.Mapping;
using SorobanSecurityPortalApi.Models.ViewModels;
using SorobanSecurityPortalApi.Services.ControllersServices;
using Xunit;

namespace SorobanSecurityPortalApi.Tests.Services
{
    public class ProtocolServiceTests
    {
        private readonly IMapper _mapper;
        private readonly Mock<IProtocolProcessor> _protocolProcessorMock;
        private readonly Mock<IReportProcessor> _reportProcessorMock;
        private readonly Mock<IVulnerabilityProcessor> _vulnerabilityProcessorMock;
        private readonly Mock<IHttpContextAccessor> _httpContextAccessorMock;
        private readonly Mock<ILoginProcessor> _loginProcessorMock;
        private readonly ProtocolService _service;

        // --- Shared test data (two protocols) ---
        private readonly ProtocolModel _protocol1 = new() { Id = 1, Name = "Alpha" };
        private readonly ProtocolModel _protocol2 = new() { Id = 2, Name = "Beta" };

        private readonly AuditorModel _auditor1 = new() { Id = 10, Name = "Auditor One" };
        private readonly AuditorModel _auditor2 = new() { Id = 11, Name = "Auditor Two" };

        private readonly CompanyModel _company1 = new() { Id = 20, Name = "Acme Corp" };

        public ProtocolServiceTests()
        {
            _protocolProcessorMock = new Mock<IProtocolProcessor>();
            _reportProcessorMock = new Mock<IReportProcessor>();
            _vulnerabilityProcessorMock = new Mock<IVulnerabilityProcessor>();
            _httpContextAccessorMock = new Mock<IHttpContextAccessor>();
            _loginProcessorMock = new Mock<ILoginProcessor>();

            var userContext = new UserContextAccessor(_httpContextAccessorMock.Object, _loginProcessorMock.Object);

            var config = new MapperConfiguration(cfg =>
            {
                cfg.AddProfile<ProtocolModelProfile>();
            });
            _mapper = config.CreateMapper();

            _service = new ProtocolService(
                _mapper,
                _protocolProcessorMock.Object,
                _reportProcessorMock.Object,
                _vulnerabilityProcessorMock.Object,
                userContext);
        }

        // ─────────────────────────────────────────────────────────────────────
        // Helpers
        // ─────────────────────────────────────────────────────────────────────

        private ReportModel MakeReport(int id, ProtocolModel protocol, AuditorModel auditor)
            => new() { Id = id, Name = $"Report-{id}", Protocol = protocol, Auditor = auditor };

        private VulnerabilityModel MakeVuln(int id, ReportModel report,
            string status,
            VulnerabilityCategory category = VulnerabilityCategory.Valid)
            => new() { Id = id, Report = report, Status = status, Category = category };

        // Convenience: approved + valid by default
        private VulnerabilityModel MakeApprovedVuln(int id, ReportModel report,
            VulnerabilityCategory category = VulnerabilityCategory.Valid)
            => MakeVuln(id, report, VulnerabilityModelStatus.Approved, category);

        private void SetupProcessors(
            List<ProtocolModel> protocols,
            List<ReportModel> reports,
            List<VulnerabilityModel> vulnerabilities)
        {
            _protocolProcessorMock.Setup(p => p.List()).ReturnsAsync(protocols);
            _reportProcessorMock.Setup(r => r.GetList(false)).ReturnsAsync(reports);
            _vulnerabilityProcessorMock.Setup(v => v.GetList()).ReturnsAsync(vulnerabilities);
        }

        // ─────────────────────────────────────────────────────────────────────
        // Tests
        // ─────────────────────────────────────────────────────────────────────

        [Fact]
        public async Task ListWithMetrics_ReturnsOneEntryPerProtocol()
        {
            SetupProcessors(
                protocols: new() { _protocol1, _protocol2 },
                reports: new(),
                vulnerabilities: new());

            var result = await _service.ListWithMetrics();

            result.Should().HaveCount(2);
            result.Select(r => r.Protocol.Id).Should().BeEquivalentTo(new[] { 1, 2 });
        }

        [Fact]
        public async Task ListWithMetrics_CountsOnlyApprovedReportsForProtocol()
        {
            var report1 = MakeReport(1, _protocol1, _auditor1);
            var report2 = MakeReport(2, _protocol1, _auditor2);

            SetupProcessors(
                protocols: new() { _protocol1 },
                reports: new() { report1, report2 },
                vulnerabilities: new());

            var result = await _service.ListWithMetrics();

            result[0].ReportsCount.Should().Be(2);
        }

        [Fact]
        public async Task ListWithMetrics_ExcludesVulnerabilitiesWithStatusNotApproved()
        {
            var report1 = MakeReport(1, _protocol1, _auditor1);

            var approvedVuln    = MakeApprovedVuln(1, report1);
            var newVuln         = MakeVuln(2, report1, VulnerabilityModelStatus.New);
            var rejectedVuln    = MakeVuln(3, report1, VulnerabilityModelStatus.Rejected);

            SetupProcessors(
                protocols: new() { _protocol1 },
                reports: new() { report1 },
                vulnerabilities: new() { approvedVuln, newVuln, rejectedVuln });

            var result = await _service.ListWithMetrics();

            // Only the approved vuln should be counted
            result[0].VulnerabilitiesCount.Should().Be(1);
        }

        [Fact]
        public async Task ListWithMetrics_ExcludesVulnerabilitiesWithCategoryInvalidOrNA()
        {
            var report1 = MakeReport(1, _protocol1, _auditor1);

            var validVuln   = MakeApprovedVuln(1, report1, VulnerabilityCategory.Valid);
            var invalidVuln = MakeApprovedVuln(2, report1, VulnerabilityCategory.Invalid);
            var naVuln      = MakeApprovedVuln(3, report1, VulnerabilityCategory.NA);

            SetupProcessors(
                protocols: new() { _protocol1 },
                reports: new() { report1 },
                vulnerabilities: new() { validVuln, invalidVuln, naVuln });

            var result = await _service.ListWithMetrics();

            // Only the Valid category vuln should be counted
            result[0].VulnerabilitiesCount.Should().Be(1);
        }

        [Fact]
        public async Task ListWithMetrics_CalculatesFixRateCorrectly()
        {
            var report1 = MakeReport(1, _protocol1, _auditor1);

            // 2 valid (fixed), 1 informational (not fixed), 1 invalid (excluded)
            var fixed1      = MakeApprovedVuln(1, report1, VulnerabilityCategory.Valid);
            var fixed2      = MakeApprovedVuln(2, report1, VulnerabilityCategory.Valid);
            var info        = MakeApprovedVuln(3, report1, VulnerabilityCategory.ValidNotFixed);
            var excluded    = MakeApprovedVuln(4, report1, VulnerabilityCategory.Invalid);

            SetupProcessors(
                protocols: new() { _protocol1 },
                reports: new() { report1 },
                vulnerabilities: new() { fixed1, fixed2, info, excluded });

            var result = await _service.ListWithMetrics();
            var m = result[0];

            // 3 total (Valid + ValidNotFixed), 2 fixed (Valid), fix rate = 67%
            m.VulnerabilitiesCount.Should().Be(3);
            m.FixedCount.Should().Be(2);
            m.FixRate.Should().Be(67);
        }

        [Fact]
        public async Task ListWithMetrics_FixRateIsZero_WhenNoVulnerabilities()
        {
            SetupProcessors(
                protocols: new() { _protocol1 },
                reports: new(),
                vulnerabilities: new());

            var result = await _service.ListWithMetrics();

            result[0].FixRate.Should().Be(0);
        }

        [Fact]
        public async Task ListWithMetrics_DoesNotMixMetricsAcrossProtocols()
        {
            _protocol1.Company = _company1;
            var report1 = MakeReport(1, _protocol1, _auditor1);
            var report2 = MakeReport(2, _protocol2, _auditor2);

            var vuln1 = MakeApprovedVuln(1, report1, VulnerabilityCategory.Valid);
            var vuln2 = MakeApprovedVuln(2, report2, VulnerabilityCategory.ValidNotFixed);

            SetupProcessors(
                protocols: new() { _protocol1, _protocol2 },
                reports: new() { report1, report2 },
                vulnerabilities: new() { vuln1, vuln2 });

            var result = await _service.ListWithMetrics();

            var alpha = result.First(r => r.Protocol.Id == 1);
            var beta  = result.First(r => r.Protocol.Id == 2);

            alpha.ReportsCount.Should().Be(1);
            alpha.VulnerabilitiesCount.Should().Be(1);
            alpha.CompanyName.Should().Be("Acme Corp");
            alpha.Auditors.Should().ContainSingle().Which.Should().Be("Auditor One");

            beta.ReportsCount.Should().Be(1);
            beta.VulnerabilitiesCount.Should().Be(1);
            beta.Auditors.Should().ContainSingle().Which.Should().Be("Auditor Two");
        }

        [Fact]
        public async Task ListWithMetrics_ReturnsNACompanyName_WhenNoReports()
        {
            SetupProcessors(
                protocols: new() { _protocol1 },
                reports: new(),
                vulnerabilities: new());

            var result = await _service.ListWithMetrics();

            result[0].CompanyName.Should().Be("N/A");
        }

        [Fact]
        public async Task ListWithMetrics_DeduplicatesAuditors()
        {
            var report1 = MakeReport(1, _protocol1, _auditor1);
            var report2 = MakeReport(2, _protocol1, _auditor1); // same auditor, second report

            SetupProcessors(
                protocols: new() { _protocol1 },
                reports: new() { report1, report2 },
                vulnerabilities: new());

            var result = await _service.ListWithMetrics();

            result[0].Auditors.Should().HaveCount(1).And.Contain("Auditor One");
        }
    }
}

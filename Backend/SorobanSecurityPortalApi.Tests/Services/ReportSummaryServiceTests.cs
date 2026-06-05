using System.Collections.Generic;
using System.Threading.Tasks;
using FluentAssertions;
using Moq;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;
using SorobanSecurityPortalApi.Services.ControllersServices;
using Xunit;

namespace SorobanSecurityPortalApi.Tests.Services
{
    public class ReportSummaryServiceTests
    {
        private readonly Mock<IReportService> _report = new();
        private readonly Mock<IVulnerabilityService> _vuln = new();

        private ReportSummaryService Sut() => new(_report.Object, _vuln.Object);

        private static VulnerabilityViewModel V(VulnerabilityCategory c) =>
            new() { Category = c, Severity = "high" };

        [Fact]
        public async Task GetStats_ComputesFixedNotFixedAndRate_MirroringUi()
        {
            _report.Setup(s => s.GetSummaryMeta(3)).ReturnsAsync(
                new ReportSummaryMeta("Acme Audit", "Runtime Verification", ReportModelStatus.Approved, new System.DateTime(2026, 1, 1)));
            var vulns = new List<VulnerabilityViewModel>();
            for (int i = 0; i < 42; i++) vulns.Add(V(VulnerabilityCategory.Valid));
            for (int i = 0; i < 4; i++) vulns.Add(V(VulnerabilityCategory.ValidNotFixed));
            for (int i = 0; i < 2; i++) vulns.Add(V(VulnerabilityCategory.Invalid));
            _vuln.Setup(s => s.Search(It.IsAny<VulnerabilitySearchViewModel>())).ReturnsAsync(vulns);

            var stats = await Sut().GetStats(3);

            stats.Should().NotBeNull();
            stats!.Total.Should().Be(48);
            stats.Fixed.Should().Be(42);
            stats.NotFixed.Should().Be(6);
            stats.FixedRate.Should().Be(88); // round(42/48*100)
            stats.ReportName.Should().Be("Acme Audit");
            stats.AuditorName.Should().Be("Runtime Verification");
            stats.Signature.Should().NotBeNullOrEmpty();
        }

        [Fact]
        public async Task GetStats_ZeroVulns_RateIsZero()
        {
            _report.Setup(s => s.GetSummaryMeta(3)).ReturnsAsync(
                new ReportSummaryMeta("Empty", null, ReportModelStatus.Approved, new System.DateTime(2026, 1, 1)));
            _vuln.Setup(s => s.Search(It.IsAny<VulnerabilitySearchViewModel>())).ReturnsAsync(new List<VulnerabilityViewModel>());

            var stats = await Sut().GetStats(3);

            stats.Should().NotBeNull();
            stats!.Total.Should().Be(0);
            stats.Fixed.Should().Be(0);
            stats.NotFixed.Should().Be(0);
            stats.FixedRate.Should().Be(0);
        }

        [Fact]
        public async Task GetStats_MissingReport_ReturnsNull()
        {
            _report.Setup(s => s.GetSummaryMeta(It.IsAny<int>())).ReturnsAsync((ReportSummaryMeta?)null);
            (await Sut().GetStats(99)).Should().BeNull();
        }

        [Fact]
        public async Task GetStats_NotApproved_ReturnsNull()
        {
            _report.Setup(s => s.GetSummaryMeta(3)).ReturnsAsync(
                new ReportSummaryMeta("Draft", null, ReportModelStatus.New, new System.DateTime(2026, 1, 1)));
            (await Sut().GetStats(3)).Should().BeNull();
        }

        [Fact]
        public async Task GetStats_SignatureChangesWhenCountsChange()
        {
            _report.Setup(s => s.GetSummaryMeta(3)).ReturnsAsync(
                new ReportSummaryMeta("Acme", null, ReportModelStatus.Approved, new System.DateTime(2026, 1, 1)));
            _vuln.Setup(s => s.Search(It.IsAny<VulnerabilitySearchViewModel>()))
                 .ReturnsAsync(new List<VulnerabilityViewModel> { V(VulnerabilityCategory.Valid) });
            var s1 = (await Sut().GetStats(3))!.Signature;

            _vuln.Setup(s => s.Search(It.IsAny<VulnerabilitySearchViewModel>()))
                 .ReturnsAsync(new List<VulnerabilityViewModel> { V(VulnerabilityCategory.Valid), V(VulnerabilityCategory.Valid) });
            var s2 = (await Sut().GetStats(3))!.Signature;

            s1.Should().NotBe(s2);
        }
    }
}

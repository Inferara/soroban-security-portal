using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Moq;
using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Tests.Services; // TestAsyncQueryProvider<T> / TestAsyncEnumerator<T>
using Xunit;

namespace SorobanSecurityPortalApi.Tests.PublicApi
{
    // The public surface must only ever return what the public site shows.
    public class PublicApiProcessorTests
    {
        private static Mock<DbSet<T>> CreateDbSetMock<T>(List<T> source) where T : class
        {
            var q = source.AsQueryable();
            var m = new Mock<DbSet<T>>();
            m.As<IQueryable<T>>().Setup(x => x.Provider).Returns(new TestAsyncQueryProvider<T>(q.Provider));
            m.As<IQueryable<T>>().Setup(x => x.Expression).Returns(q.Expression);
            m.As<IQueryable<T>>().Setup(x => x.ElementType).Returns(q.ElementType);
            m.As<IQueryable<T>>().Setup(x => x.GetEnumerator()).Returns(q.GetEnumerator());
            m.As<IAsyncEnumerable<T>>().Setup(x => x.GetAsyncEnumerator(It.IsAny<CancellationToken>()))
                .Returns(new TestAsyncEnumerator<T>(q.GetEnumerator()));
            return m;
        }

        private static PublicApiProcessor Build(List<VulnerabilityModel>? vulnerabilities = null, List<ReportModel>? reports = null)
        {
            var dbMock = new Mock<Db>(
                new Mock<IDbQuery>().Object,
                new Mock<Microsoft.Extensions.Logging.ILogger<Db>>().Object,
                new Mock<IDataSourceProvider>().Object) { CallBase = true };
            dbMock.Setup(d => d.Vulnerability).Returns(CreateDbSetMock(vulnerabilities ?? new()).Object);
            dbMock.Setup(d => d.Report).Returns(CreateDbSetMock(reports ?? new()).Object);
            var factory = new Mock<IDbContextFactory<Db>>();
            factory.Setup(f => f.CreateDbContextAsync(It.IsAny<CancellationToken>())).ReturnsAsync(dbMock.Object);
            return new PublicApiProcessor(factory.Object);
        }

        private static ReportModel Report(int id = 5) => new()
        {
            Id = id,
            Name = "Audit",
            Status = ReportModelStatus.Approved,
            MdFile = "# report text",
            BinFile = new byte[] { 1, 2, 3 },
            Image = new byte[] { 4, 5 },
            Protocol = new ProtocolModel { Id = 1, Name = "Blend", Image = new byte[] { 9 }, Company = new CompanyModel { Id = 4, Name = "Script3" } },
            Auditor = new AuditorModel { Id = 9, Name = "Veridise" },
        };

        private static VulnerabilityModel Vuln(int id = 10) => new()
        {
            Id = id,
            Title = "Finding",
            Description = "body",
            Severity = "High",
            Status = VulnerabilityModelStatus.Approved,
            Category = VulnerabilityCategory.Valid,
            CreatedBy = 77,
            Report = Report(),
            ReportId = 5,
        };

        [Fact]
        public async Task Approved_Visible_Finding_Is_Returned_With_Its_Report_Chain_And_Nothing_Internal()
        {
            var result = await Build(new List<VulnerabilityModel> { Vuln() }).GetVulnerability(10);

            result.Should().NotBeNull();
            result!.Description.Should().Be("body");
            result.Report!.Name.Should().Be("Audit");
            result.Report.Protocol!.Company!.Name.Should().Be("Script3");
            result.Report.Auditor!.Name.Should().Be("Veridise");
            // Slim projection: no creator, no blobs.
            result.CreatedBy.Should().Be(0);
            result.Report.BinFile.Should().BeNull();
            result.Report.Image.Should().BeNull();
            result.Report.MdFile.Should().BeEmpty();
            result.Report.Protocol.Image.Should().BeNull();
        }

        public static IEnumerable<object[]> InvisibleFindings()
        {
            yield return new object[] { "new", VulnerabilityCategory.Valid, false, false };
            yield return new object[] { "rejected", VulnerabilityCategory.Valid, false, false };
            yield return new object[] { "approved", VulnerabilityCategory.Invalid, false, false };
            yield return new object[] { "approved", VulnerabilityCategory.Valid, true, false };
            yield return new object[] { "approved", VulnerabilityCategory.Valid, false, true };
        }

        [Theory]
        [MemberData(nameof(InvisibleFindings))]
        public async Task Unapproved_Invalid_Hidden_Or_Deleted_Finding_Is_Not_Found(string status, VulnerabilityCategory category, bool hidden, bool deleted)
        {
            var v = Vuln();
            v.Status = status;
            v.Category = category;
            v.IsHidden = hidden;
            v.IsDeleted = deleted;

            (await Build(new List<VulnerabilityModel> { v }).GetVulnerability(10)).Should().BeNull();
        }

        [Theory]
        [InlineData(true, false, "approved")]
        [InlineData(false, true, "approved")]
        [InlineData(false, false, "new")]
        public async Task A_Visible_Finding_Does_Not_Leak_Its_Hidden_Report(bool reportHidden, bool reportDeleted, string reportStatus)
        {
            var v = Vuln();
            v.Report!.IsHidden = reportHidden;
            v.Report.IsDeleted = reportDeleted;
            v.Report.Status = reportStatus;

            var result = await Build(new List<VulnerabilityModel> { v }).GetVulnerability(10);

            result.Should().NotBeNull();
            result!.Report.Should().BeNull();
        }

        [Fact]
        public async Task Report_Is_Returned_Without_Pdf_Or_Image_And_With_Text_Only_On_Request()
        {
            var processor = Build(reports: new List<ReportModel> { Report() });

            var slim = await processor.GetReport(5, includeContent: false);
            var full = await processor.GetReport(5, includeContent: true);

            slim!.MdFile.Should().BeEmpty();
            full!.MdFile.Should().Be("# report text");
            full.BinFile.Should().BeNull();
            full.Image.Should().BeNull();
            full.Protocol!.Company!.Name.Should().Be("Script3");
        }

        [Theory]
        [InlineData("new", false, false)]
        [InlineData("rejected", false, false)]
        [InlineData("approved", true, false)]
        [InlineData("approved", false, true)]
        public async Task Unapproved_Hidden_Or_Deleted_Report_Is_Not_Found(string status, bool hidden, bool deleted)
        {
            var r = Report();
            r.Status = status;
            r.IsHidden = hidden;
            r.IsDeleted = deleted;

            (await Build(reports: new List<ReportModel> { r }).GetReport(5, true)).Should().BeNull();
        }

        [Fact]
        public async Task Severity_Counts_Fold_Case_And_Skip_What_The_Public_Does_Not_See()
        {
            VulnerabilityModel V(string severity, string status = "approved", VulnerabilityCategory category = VulnerabilityCategory.Valid, bool hidden = false, int reportId = 5) =>
                new() { ReportId = reportId, Severity = severity, Status = status, Category = category, IsHidden = hidden };

            var counts = await Build(new List<VulnerabilityModel>
            {
                V("High"), V("high"), V("Low"),
                V("High", status: "new"),
                V("High", category: VulnerabilityCategory.Invalid),
                V("High", category: VulnerabilityCategory.NA),
                V("High", hidden: true),
                V("High", reportId: 6),
            }).CountReportFindingsBySeverity(5);

            counts.Should().BeEquivalentTo(new Dictionary<string, int> { ["high"] = 2, ["low"] = 1 });
        }
    }
}

using System;
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

namespace SorobanSecurityPortalApi.Tests.Data
{
    // Home page "Reports" tile (issue #201): the "+N this month" delta must count reports ADDED to
    // the portal in the last month, keyed on the immutable CreatedAt - not on the audit date and not
    // on LastActionAt, which every edit / approval / cover refresh bumps.
    public class ReportProcessorStatisticsTests
    {
        private static readonly DateTime Now = DateTime.UtcNow;
        private static readonly DateTime Recent = Now.AddDays(-3);
        private static readonly DateTime Old = Now.AddMonths(-4);

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

        private static (ReportProcessor Processor, Mock<Db> Db) Build(List<ReportModel> reports)
        {
            var dbMock = new Mock<Db>(
                new Mock<IDbQuery>().Object,
                new Mock<Microsoft.Extensions.Logging.ILogger<Db>>().Object,
                new Mock<IDataSourceProvider>().Object) { CallBase = true };
            dbMock.Setup(d => d.Report).Returns(CreateDbSetMock(reports).Object);
            dbMock.Setup(d => d.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

            var factory = new Mock<IDbContextFactory<Db>>();
            factory.Setup(f => f.CreateDbContextAsync(It.IsAny<CancellationToken>())).ReturnsAsync(dbMock.Object);
            return (new ReportProcessor(factory.Object, null!), dbMock);
        }

        private static ReportModel Approved(int id, DateTime auditDate, DateTime createdAt, DateTime? lastActionAt = null) => new()
        {
            Id = id,
            Name = $"Report {id}",
            Status = ReportModelStatus.Approved,
            Date = auditDate,
            CreatedAt = createdAt,
            LastActionAt = lastActionAt ?? createdAt,
        };

        [Fact]
        public async Task Report_Uploaded_This_Month_With_Old_Audit_Date_Counts_As_New()
        {
            // The exact case from the issue: "Volta Wallet - Zellic", uploaded today, audit date Jan 30.
            var (processor, _) = Build(new List<ReportModel>
            {
                Approved(1, auditDate: Old, createdAt: Recent),
                Approved(2, auditDate: Old.AddMonths(-3), createdAt: Recent),
            });

            var stats = await processor.GetStatisticsChanges();

            stats.Total.Should().Be(2);
            stats.New.Should().Be(2);
        }

        [Fact]
        public async Task Editing_Or_Recompressing_An_Old_Report_Does_Not_Make_It_New()
        {
            // LastActionAt moved this week (admin edit / cover recompression) but the report has been
            // on the portal for months.
            var (processor, _) = Build(new List<ReportModel>
            {
                Approved(1, auditDate: Old, createdAt: Old, lastActionAt: Recent),
            });

            var stats = await processor.GetStatisticsChanges();

            stats.Total.Should().Be(1);
            stats.New.Should().Be(0);
        }

        [Fact]
        public async Task Audit_Date_Alone_Does_Not_Make_A_Report_New()
        {
            // A report whose audit happened this month but which was added to the portal long ago
            // (e.g. a date correction) is not a new addition.
            var (processor, _) = Build(new List<ReportModel>
            {
                Approved(1, auditDate: Recent, createdAt: Old),
            });

            var stats = await processor.GetStatisticsChanges();

            stats.New.Should().Be(0);
        }

        [Fact]
        public async Task Unapproved_Hidden_And_Deleted_Reports_Are_Excluded_From_Both_Counts()
        {
            var pending = Approved(10, Old, Recent); pending.Status = ReportModelStatus.New;
            var rejected = Approved(11, Old, Recent); rejected.Status = ReportModelStatus.Rejected;
            var hidden = Approved(12, Old, Recent); hidden.IsHidden = true;
            var deleted = Approved(13, Old, Recent); deleted.IsDeleted = true;
            var (processor, _) = Build(new List<ReportModel>
            {
                Approved(1, Old, Recent),
                Approved(2, Old, Old),
                pending, rejected, hidden, deleted,
            });

            var stats = await processor.GetStatisticsChanges();

            stats.Total.Should().Be(2);
            stats.New.Should().Be(1);
        }

        [Fact]
        public async Task Boundary_Exactly_One_Month_Ago_Is_Inclusive()
        {
            // The query is CreatedAt >= UtcNow - 1 month; a report a minute inside the window counts,
            // one a day outside does not.
            var (processor, _) = Build(new List<ReportModel>
            {
                Approved(1, Old, DateTime.UtcNow.AddMonths(-1).AddMinutes(1)),
                Approved(2, Old, DateTime.UtcNow.AddMonths(-1).AddDays(-1)),
            });

            var stats = await processor.GetStatisticsChanges();

            stats.New.Should().Be(1);
        }

        [Fact]
        public async Task Add_Stamps_CreatedAt_With_Current_Utc_Time()
        {
            var (processor, _) = Build(new List<ReportModel>());
            var report = new ReportModel { Name = "Fresh upload", Date = Old };

            var added = await processor.Add(report);

            added.CreatedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromMinutes(1));
            added.CreatedAt.Kind.Should().Be(DateTimeKind.Utc);
            added.Status.Should().Be(ReportModelStatus.New);
            added.Date.Should().Be(Old, "the audit date is user data and must not be touched");
        }

        [Fact]
        public async Task Add_Overwrites_A_Client_Supplied_CreatedAt()
        {
            // CreatedAt is server-owned; a value smuggled in through the upload payload must not
            // be able to backdate (or future-date) a report.
            var (processor, _) = Build(new List<ReportModel>());
            var report = new ReportModel { Name = "Backdated", CreatedAt = Old };

            var added = await processor.Add(report);

            added.CreatedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromMinutes(1));
        }
    }
}

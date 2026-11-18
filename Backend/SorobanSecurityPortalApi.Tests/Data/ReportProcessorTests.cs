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
using SorobanSecurityPortalApi.Tests.Services;
using Xunit;

namespace SorobanSecurityPortalApi.Tests.Data
{
    public class ReportProcessorTests
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

        private static ReportProcessor BuildProcessor(List<ReportModel> list)
        {
            var dbMock = new Mock<Db>(
                new Mock<IDbQuery>().Object,
                new Mock<Microsoft.Extensions.Logging.ILogger<Db>>().Object,
                new Mock<IDataSourceProvider>().Object) { CallBase = true };
            dbMock.Setup(d => d.Report).Returns(CreateDbSetMock(list).Object);

            var factory = new Mock<IDbContextFactory<Db>>();
            factory.Setup(f => f.CreateDbContextAsync(It.IsAny<CancellationToken>())).ReturnsAsync(dbMock.Object);
            return new ReportProcessor(factory.Object, null!);
        }

        [Fact]
        public async Task GetStatisticsChanges_Counts_Reports_Added_Recently_Despite_Old_Audit_Date()
        {
            var reports = new List<ReportModel>
            {
                // Old audit date (6 months ago), but published/approved on portal 2 days ago -> counted as New
                new()
                {
                    Id = 1,
                    Name = "Historical Audit 1",
                    Date = DateTime.UtcNow.AddMonths(-6),
                    LastActionAt = DateTime.UtcNow.AddDays(-2),
                    Status = ReportModelStatus.Approved,
                    IsHidden = false,
                    IsDeleted = false
                },
                // Recent audit date (10 days ago), recent LastActionAt -> counted as New
                new()
                {
                    Id = 2,
                    Name = "Recent Audit 2",
                    Date = DateTime.UtcNow.AddDays(-10),
                    LastActionAt = DateTime.UtcNow.AddDays(-1),
                    Status = ReportModelStatus.Approved,
                    IsHidden = false,
                    IsDeleted = false
                },
                // Old audit date, old LastActionAt (2 months ago) -> NOT new
                new()
                {
                    Id = 3,
                    Name = "Old Audit 3",
                    Date = DateTime.UtcNow.AddMonths(-6),
                    LastActionAt = DateTime.UtcNow.AddMonths(-2),
                    Status = ReportModelStatus.Approved,
                    IsHidden = false,
                    IsDeleted = false
                },
                // Hidden report -> ignored
                new()
                {
                    Id = 4,
                    Name = "Hidden Audit",
                    Date = DateTime.UtcNow.AddMonths(-6),
                    LastActionAt = DateTime.UtcNow.AddDays(-1),
                    Status = ReportModelStatus.Approved,
                    IsHidden = true,
                    IsDeleted = false
                },
                // Unapproved report -> ignored
                new()
                {
                    Id = 5,
                    Name = "Unapproved Audit",
                    Date = DateTime.UtcNow.AddMonths(-6),
                    LastActionAt = DateTime.UtcNow.AddDays(-1),
                    Status = ReportModelStatus.New,
                    IsHidden = false,
                    IsDeleted = false
                },
                // Legacy report with default LastActionAt, but recent Date -> fallback counted as New
                new()
                {
                    Id = 6,
                    Name = "Legacy Report Recent Date",
                    Date = DateTime.UtcNow.AddDays(-5),
                    LastActionAt = default,
                    Status = ReportModelStatus.Approved,
                    IsHidden = false,
                    IsDeleted = false
                }
            };

            var stats = await BuildProcessor(reports).GetStatisticsChanges();

            // Total approved, visible, not deleted: Id 1, 2, 3, 6 = 4 total
            stats.Total.Should().Be(4);
            // New this month: Id 1 (recent LastActionAt), Id 2 (recent LastActionAt), Id 6 (legacy fallback) = 3 new
            stats.New.Should().Be(3);
        }
    }
}

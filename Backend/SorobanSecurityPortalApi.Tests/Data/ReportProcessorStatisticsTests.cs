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
    public class ReportProcessorStatisticsTests
    {
        private static Mock<DbSet<T>> MockDbSet<T>(List<T> source) where T : class
        {
            var queryable = source.AsQueryable();
            var mock = new Mock<DbSet<T>>();
            mock.As<IQueryable<T>>().Setup(x => x.Provider).Returns(new TestAsyncQueryProvider<T>(queryable.Provider));
            mock.As<IQueryable<T>>().Setup(x => x.Expression).Returns(queryable.Expression);
            mock.As<IQueryable<T>>().Setup(x => x.ElementType).Returns(queryable.ElementType);
            mock.As<IQueryable<T>>().Setup(x => x.GetEnumerator()).Returns(queryable.GetEnumerator());
            mock.As<IAsyncEnumerable<T>>().Setup(x => x.GetAsyncEnumerator(It.IsAny<CancellationToken>()))
                .Returns(new TestAsyncEnumerator<T>(queryable.GetEnumerator()));
            mock.Setup(d => d.Add(It.IsAny<T>())).Callback<T>(source.Add);
            mock.Setup(d => d.AddRange(It.IsAny<IEnumerable<T>>())).Callback<IEnumerable<T>>(source.AddRange);
            return mock;
        }

        private static Mock<IDbContextFactory<Db>> CreateFactory(List<ReportModel> reports, out Mock<Db> dbMock)
        {
            dbMock = new Mock<Db>(
                new Mock<IDbQuery>().Object,
                new Mock<Microsoft.Extensions.Logging.ILogger<Db>>().Object,
                new Mock<IDataSourceProvider>().Object) { CallBase = true };
            dbMock.Setup(d => d.Report).Returns(MockDbSet(reports).Object);
            dbMock.Setup(d => d.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
            var factory = new Mock<IDbContextFactory<Db>>();
            factory.Setup(x => x.CreateDbContextAsync(It.IsAny<CancellationToken>())).ReturnsAsync(dbMock.Object);
            return factory;
        }

        private static ReportModel CreateReport(
            int id,
            string status = ReportModelStatus.Approved,
            DateTime auditDate = default,
            DateTime lastActionAt = default,
            bool isHidden = false,
            bool isDeleted = false)
        {
            return new ReportModel
            {
                Id = id,
                Name = $"Report {id}",
                Status = status,
                Date = auditDate == default ? DateTime.UtcNow.AddMonths(-6) : auditDate,
                LastActionAt = lastActionAt == default ? DateTime.UtcNow.AddDays(-5) : lastActionAt,
                IsHidden = isHidden,
                IsDeleted = isDeleted,
            };
        }

        [Fact]
        public async Task GetStatisticsChanges_IncludesReportsAddedRecently_EvenWhenAuditDateIsOld()
        {
            // Bug #201: Reports uploaded today with audit date 6 months ago were invisible (0 this month).
            // With the fix, LastActionAt (when added/approved on portal) is used, so they appear in +N this month.
            var reports = new List<ReportModel>
            {
                // Old audit date (5 months ago), but uploaded/approved 2 days ago -> SHOULD be counted as new this month
                CreateReport(1, auditDate: DateTime.UtcNow.AddMonths(-5), lastActionAt: DateTime.UtcNow.AddDays(-2)),
                // Old audit date (8 months ago), uploaded/approved yesterday -> SHOULD be counted as new this month
                CreateReport(2, auditDate: DateTime.UtcNow.AddMonths(-8), lastActionAt: DateTime.UtcNow.AddDays(-1)),
                // Old audit date AND added 3 months ago -> SHOULD NOT be counted as new this month
                CreateReport(3, auditDate: DateTime.UtcNow.AddMonths(-4), lastActionAt: DateTime.UtcNow.AddMonths(-3)),
                // Pending/rejected report -> SHOULD NOT be counted
                CreateReport(4, status: ReportModelStatus.New, lastActionAt: DateTime.UtcNow.AddDays(-1)),
                // Hidden report -> SHOULD NOT be counted
                CreateReport(5, isHidden: true, lastActionAt: DateTime.UtcNow.AddDays(-1)),
                // Deleted report -> SHOULD NOT be counted
                CreateReport(6, isDeleted: true, lastActionAt: DateTime.UtcNow.AddDays(-1)),
            };

            var factory = CreateFactory(reports, out _);
            var processor = new ReportProcessor(factory.Object, new ExtendedConfig());

            var stats = await processor.GetStatisticsChanges();

            // Total approved, visible, non-deleted = Reports 1, 2, 3
            stats.Total.Should().Be(3);
            // New this month = Reports 1 and 2
            stats.New.Should().Be(2);
        }

        [Fact]
        public async Task GetStatisticsChanges_SupportsLegacyReportsWithoutLastActionAt_UsingAuditDateFallback()
        {
            var reports = new List<ReportModel>
            {
                // Legacy report with LastActionAt == DateTime.MinValue but recent Date
                CreateReport(1, auditDate: DateTime.UtcNow.AddDays(-10), lastActionAt: DateTime.MinValue),
            };

            var factory = CreateFactory(reports, out _);
            var processor = new ReportProcessor(factory.Object, new ExtendedConfig());

            var stats = await processor.GetStatisticsChanges();

            stats.Total.Should().Be(1);
            stats.New.Should().Be(1);
        }
    }
}

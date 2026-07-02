using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.DbModels;
using Xunit;

namespace SorobanSecurityPortalApi.Tests.Services
{
    /// <summary>
    /// Phase 5: Verifies that hidden and soft-deleted content is excluded from public processor queries.
    /// Tests call VulnerabilityProcessor.Search(null) and ReportProcessor.GetList(false) which
    /// are the entry points for public listing and both use the updated Approved+!IsHidden+!IsDeleted filter.
    /// </summary>
    public class PublicVisibilityTests
    {
        // ---- Helpers ----

        private static Mock<DbSet<T>> CreateDbSetMock<T>(List<T> sourceList) where T : class
        {
            var queryable = sourceList.AsQueryable();
            var dbSetMock = new Mock<DbSet<T>>();

            dbSetMock.As<IQueryable<T>>().Setup(m => m.Provider)
                .Returns(new TestAsyncQueryProvider<T>(queryable.Provider));
            dbSetMock.As<IQueryable<T>>().Setup(m => m.Expression).Returns(queryable.Expression);
            dbSetMock.As<IQueryable<T>>().Setup(m => m.ElementType).Returns(queryable.ElementType);
            dbSetMock.As<IQueryable<T>>().Setup(m => m.GetEnumerator()).Returns(queryable.GetEnumerator());
            dbSetMock.As<IAsyncEnumerable<T>>()
                .Setup(m => m.GetAsyncEnumerator(It.IsAny<CancellationToken>()))
                .Returns(new TestAsyncEnumerator<T>(queryable.GetEnumerator()));

            dbSetMock.Setup(d => d.Add(It.IsAny<T>())).Callback<T>(sourceList.Add);
            dbSetMock.Setup(d => d.AddRange(It.IsAny<IEnumerable<T>>()))
                .Callback<IEnumerable<T>>(sourceList.AddRange);

            return dbSetMock;
        }

        private static (VulnerabilityProcessor processor, Mock<IDbContextFactory<Db>> factory)
            BuildVulnerabilityProcessor(List<VulnerabilityModel> list)
        {
            var dbQueryMock = new Mock<IDbQuery>();
            var loggerMock = new Mock<ILogger<Db>>();
            var dataSourceProviderMock = new Mock<IDataSourceProvider>();

            var dbMock = new Mock<Db>(
                dbQueryMock.Object,
                loggerMock.Object,
                dataSourceProviderMock.Object
            ) { CallBase = true };

            dbMock.Setup(d => d.Vulnerability).Returns(CreateDbSetMock(list).Object);
            dbMock.Setup(d => d.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

            var factoryMock = new Mock<IDbContextFactory<Db>>();
            factoryMock
                .Setup(f => f.CreateDbContextAsync(It.IsAny<CancellationToken>()))
                .ReturnsAsync(dbMock.Object);

            // ExtendedConfig is never accessed by Search(null) — the search-text / embedding
            // branch is skipped when s == null, so passing null! is safe here.
            var processor = new VulnerabilityProcessor(factoryMock.Object, null!);
            return (processor, factoryMock);
        }

        private static (ReportProcessor processor, Mock<IDbContextFactory<Db>> factory)
            BuildReportProcessor(List<ReportModel> list)
        {
            var dbQueryMock = new Mock<IDbQuery>();
            var loggerMock = new Mock<ILogger<Db>>();
            var dataSourceProviderMock = new Mock<IDataSourceProvider>();

            var dbMock = new Mock<Db>(
                dbQueryMock.Object,
                loggerMock.Object,
                dataSourceProviderMock.Object
            ) { CallBase = true };

            dbMock.Setup(d => d.Report).Returns(CreateDbSetMock(list).Object);
            dbMock.Setup(d => d.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

            var factoryMock = new Mock<IDbContextFactory<Db>>();
            factoryMock
                .Setup(f => f.CreateDbContextAsync(It.IsAny<CancellationToken>()))
                .ReturnsAsync(dbMock.Object);

            // ExtendedConfig is never accessed by GetList — no search-text path; null! is safe.
            var processor = new ReportProcessor(factoryMock.Object, null!);
            return (processor, factoryMock);
        }

        // ---- Vulnerability tests ----

        [Fact]
        public async Task VulnerabilitySearch_ExcludesHiddenContent()
        {
            var visible = new VulnerabilityModel
            {
                Id = 1,
                Status = VulnerabilityModelStatus.Approved,
                Category = VulnerabilityCategory.Valid,
                IsHidden = false,
                IsDeleted = false,
                Title = "Visible"
            };
            var hidden = new VulnerabilityModel
            {
                Id = 2,
                Status = VulnerabilityModelStatus.Approved,
                Category = VulnerabilityCategory.Valid,
                IsHidden = true,
                IsDeleted = false,
                Title = "Hidden"
            };

            var (processor, _) = BuildVulnerabilityProcessor(new List<VulnerabilityModel> { visible, hidden });

            var result = await processor.Search(null);

            result.Should().HaveCount(1);
            result[0].Id.Should().Be(1);
            result[0].Title.Should().Be("Visible");
        }

        [Fact]
        public async Task VulnerabilitySearch_ExcludesDeletedContent()
        {
            var visible = new VulnerabilityModel
            {
                Id = 1,
                Status = VulnerabilityModelStatus.Approved,
                Category = VulnerabilityCategory.Valid,
                IsHidden = false,
                IsDeleted = false,
                Title = "Visible"
            };
            var deleted = new VulnerabilityModel
            {
                Id = 3,
                Status = VulnerabilityModelStatus.Approved,
                Category = VulnerabilityCategory.Valid,
                IsHidden = false,
                IsDeleted = true,
                Title = "Deleted"
            };

            var (processor, _) = BuildVulnerabilityProcessor(new List<VulnerabilityModel> { visible, deleted });

            var result = await processor.Search(null);

            result.Should().HaveCount(1);
            result[0].Id.Should().Be(1);
            result[0].Title.Should().Be("Visible");
        }

        [Fact]
        public async Task VulnerabilitySearch_ReturnsOnlyApprovedVisibleContent()
        {
            // Hidden+Deleted both excluded; unapproved excluded; only the clean visible one comes through.
            var list = new List<VulnerabilityModel>
            {
                new() { Id = 1, Status = VulnerabilityModelStatus.Approved, Category = VulnerabilityCategory.Valid, IsHidden = false, IsDeleted = false, Title = "OK" },
                new() { Id = 2, Status = VulnerabilityModelStatus.Approved, Category = VulnerabilityCategory.Valid, IsHidden = true,  IsDeleted = false, Title = "Hidden" },
                new() { Id = 3, Status = VulnerabilityModelStatus.Approved, Category = VulnerabilityCategory.Valid, IsHidden = false, IsDeleted = true,  Title = "Deleted" },
                new() { Id = 4, Status = VulnerabilityModelStatus.New,      Category = VulnerabilityCategory.Valid, IsHidden = false, IsDeleted = false, Title = "Unapproved" },
            };

            var (processor, _) = BuildVulnerabilityProcessor(list);

            var result = await processor.Search(null);

            result.Should().HaveCount(1);
            result[0].Id.Should().Be(1);
        }

        // ---- Report tests ----

        [Fact]
        public async Task ReportGetList_ExcludesHiddenContent()
        {
            var visible = new ReportModel
            {
                Id = 10,
                Status = ReportModelStatus.Approved,
                IsHidden = false,
                IsDeleted = false,
                Name = "Visible Report"
            };
            var hidden = new ReportModel
            {
                Id = 20,
                Status = ReportModelStatus.Approved,
                IsHidden = true,
                IsDeleted = false,
                Name = "Hidden Report"
            };

            var (processor, _) = BuildReportProcessor(new List<ReportModel> { visible, hidden });

            var result = await processor.GetList(includeNotApproved: false);

            result.Should().HaveCount(1);
            result[0].Id.Should().Be(10);
            result[0].Name.Should().Be("Visible Report");
        }

        [Fact]
        public async Task ReportGetList_ExcludesDeletedContent()
        {
            var visible = new ReportModel
            {
                Id = 10,
                Status = ReportModelStatus.Approved,
                IsHidden = false,
                IsDeleted = false,
                Name = "Visible Report"
            };
            var deleted = new ReportModel
            {
                Id = 30,
                Status = ReportModelStatus.Approved,
                IsHidden = false,
                IsDeleted = true,
                Name = "Deleted Report"
            };

            var (processor, _) = BuildReportProcessor(new List<ReportModel> { visible, deleted });

            var result = await processor.GetList(includeNotApproved: false);

            result.Should().HaveCount(1);
            result[0].Id.Should().Be(10);
        }

        [Fact]
        public async Task ReportGetList_IncludeNotApproved_ReturnsAllIncludingHidden()
        {
            // Admin path: includeNotApproved: true must NOT apply the visibility filter —
            // this verifies we only touched the public branch.
            var list = new List<ReportModel>
            {
                new() { Id = 10, Status = ReportModelStatus.Approved,  IsHidden = false, IsDeleted = false, Name = "Approved" },
                new() { Id = 20, Status = ReportModelStatus.Approved,  IsHidden = true,  IsDeleted = false, Name = "Hidden Approved" },
                new() { Id = 30, Status = ReportModelStatus.New,       IsHidden = false, IsDeleted = false, Name = "New" },
            };

            var (processor, _) = BuildReportProcessor(list);

            var result = await processor.GetList(includeNotApproved: true);

            result.Should().HaveCount(3, "admin path returns all records regardless of hidden/deleted/status");
        }

        // ---- GetPublic (direct-URL detail path) tests ----

        [Fact]
        public async Task VulnerabilityGetPublic_ReturnsEntity_WhenVisible()
        {
            var vuln = new VulnerabilityModel { Id = 1, IsHidden = false, IsDeleted = false, Title = "Visible" };
            var (processor, _) = BuildVulnerabilityProcessor(new List<VulnerabilityModel> { vuln });

            var result = await processor.GetPublic(1);

            result.Should().NotBeNull();
            result!.Id.Should().Be(1);
        }

        [Fact]
        public async Task VulnerabilityGetPublic_ReturnsNull_WhenHidden()
        {
            var vuln = new VulnerabilityModel { Id = 1, IsHidden = true, IsDeleted = false, Title = "Hidden" };
            var (processor, _) = BuildVulnerabilityProcessor(new List<VulnerabilityModel> { vuln });

            var result = await processor.GetPublic(1);

            result.Should().BeNull();
        }

        [Fact]
        public async Task VulnerabilityGetPublic_ReturnsNull_WhenDeleted()
        {
            var vuln = new VulnerabilityModel { Id = 1, IsHidden = false, IsDeleted = true, Title = "Deleted" };
            var (processor, _) = BuildVulnerabilityProcessor(new List<VulnerabilityModel> { vuln });

            var result = await processor.GetPublic(1);

            result.Should().BeNull();
        }

        [Fact]
        public async Task ReportGetPublic_ReturnsEntity_WhenVisible()
        {
            var report = new ReportModel { Id = 10, IsHidden = false, IsDeleted = false, Name = "Visible" };
            var (processor, _) = BuildReportProcessor(new List<ReportModel> { report });

            var result = await processor.GetPublic(10);

            result.Should().NotBeNull();
            result!.Id.Should().Be(10);
        }

        [Fact]
        public async Task ReportGetPublic_ReturnsNull_WhenHidden()
        {
            var report = new ReportModel { Id = 10, IsHidden = true, IsDeleted = false, Name = "Hidden" };
            var (processor, _) = BuildReportProcessor(new List<ReportModel> { report });

            var result = await processor.GetPublic(10);

            result.Should().BeNull();
        }

        [Fact]
        public async Task ReportGetPublic_ReturnsNull_WhenDeleted()
        {
            var report = new ReportModel { Id = 10, IsHidden = false, IsDeleted = true, Name = "Deleted" };
            var (processor, _) = BuildReportProcessor(new List<ReportModel> { report });

            var result = await processor.GetPublic(10);

            result.Should().BeNull();
        }
    }

    // ---- Statistics Changes tests ----

    [Fact]
    public async Task ReportGetStatisticsChanges_CountsReportsWithRecentLastActionAt()
    {
        var ago = DateTime.UtcNow.AddMonths(-1);
        var list = new List<ReportModel>
        {
            new()
            {
                Id = 1, Status = ReportModelStatus.Approved, IsHidden = false, IsDeleted = false,
                Name = "Recent", LastActionAt = DateTime.UtcNow.AddDays(-5),
                Date = DateTime.UtcNow.AddMonths(-6) // old audit date, should still count
            },
            new()
            {
                Id = 2, Status = ReportModelStatus.Approved, IsHidden = false, IsDeleted = false,
                Name = "Old", LastActionAt = DateTime.UtcNow.AddMonths(-3),
                Date = DateTime.UtcNow
            },
        };

        var (processor, _) = BuildReportProcessor(list);

        var result = await processor.GetStatisticsChanges();

        result.Total.Should().Be(2);
        result.New.Should().Be(1, "only the report with LastActionAt within the last month counts");
    }

    [Fact]
    public async Task ReportGetStatisticsChanges_ExcludesHiddenDeletedUnapproved()
    {
        var list = new List<ReportModel>
        {
            new()
            {
                Id = 1, Status = ReportModelStatus.Approved, IsHidden = false, IsDeleted = false,
                Name = "Visible Approved", LastActionAt = DateTime.UtcNow.AddDays(-1)
            },
            new()
            {
                Id = 2, Status = ReportModelStatus.Approved, IsHidden = true, IsDeleted = false,
                Name = "Hidden Approved", LastActionAt = DateTime.UtcNow.AddDays(-1)
            },
            new()
            {
                Id = 3, Status = ReportModelStatus.Approved, IsHidden = false, IsDeleted = true,
                Name = "Deleted Approved", LastActionAt = DateTime.UtcNow.AddDays(-1)
            },
            new()
            {
                Id = 4, Status = ReportModelStatus.New, IsHidden = false, IsDeleted = false,
                Name = "Unapproved", LastActionAt = DateTime.UtcNow.AddDays(-1)
            },
        };

        var (processor, _) = BuildReportProcessor(list);

        var result = await processor.GetStatisticsChanges();

        result.Total.Should().Be(1);
        result.New.Should().Be(1);
    }
}

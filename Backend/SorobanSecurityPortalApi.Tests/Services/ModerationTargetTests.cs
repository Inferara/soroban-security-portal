using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Moq;
using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Services.Moderation;
using Xunit;

namespace SorobanSecurityPortalApi.Tests.Services
{
    public class ModerationTargetTests
    {
        // --- Helpers ---

        private static Mock<DbSet<T>> CreateDbSetMock<T>(List<T> sourceList) where T : class
        {
            var queryable = sourceList.AsQueryable();
            var dbSetMock = new Mock<DbSet<T>>();

            dbSetMock.As<IQueryable<T>>().Setup(m => m.Provider).Returns(new TestAsyncQueryProvider<T>(queryable.Provider));
            dbSetMock.As<IQueryable<T>>().Setup(m => m.Expression).Returns(queryable.Expression);
            dbSetMock.As<IQueryable<T>>().Setup(m => m.ElementType).Returns(queryable.ElementType);
            dbSetMock.As<IQueryable<T>>().Setup(m => m.GetEnumerator()).Returns(queryable.GetEnumerator());
            dbSetMock.As<IAsyncEnumerable<T>>().Setup(m => m.GetAsyncEnumerator(It.IsAny<CancellationToken>()))
                .Returns(new TestAsyncEnumerator<T>(queryable.GetEnumerator()));

            dbSetMock.Setup(d => d.Add(It.IsAny<T>())).Callback<T>(sourceList.Add);
            dbSetMock.Setup(d => d.AddRange(It.IsAny<IEnumerable<T>>())).Callback<IEnumerable<T>>(sourceList.AddRange);

            return dbSetMock;
        }

        private static (Mock<IDbContextFactory<Db>> factory, Mock<Db> db) BuildVulnerabilityFactory(List<VulnerabilityModel> list)
        {
            var dbQueryMock = new Mock<IDbQuery>();
            var loggerMock = new Mock<Microsoft.Extensions.Logging.ILogger<Db>>();
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

            return (factoryMock, dbMock);
        }

        private static (Mock<IDbContextFactory<Db>> factory, Mock<Db> db) BuildReportFactory(List<ReportModel> list)
        {
            var dbQueryMock = new Mock<IDbQuery>();
            var loggerMock = new Mock<Microsoft.Extensions.Logging.ILogger<Db>>();
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

            return (factoryMock, dbMock);
        }

        // --- VulnerabilityModerationTarget tests ---

        [Fact]
        public async Task Vulnerability_Get_Returns_MappedInfo_ForExistingId()
        {
            var vuln = new VulnerabilityModel
            {
                Id = 1,
                Title = "Reentrancy Bug",
                Description = "Detailed description here",
                CreatedBy = 42,
                IsHidden = false,
                IsDeleted = false
            };
            var (factory, _) = BuildVulnerabilityFactory(new List<VulnerabilityModel> { vuln });
            var target = new VulnerabilityModerationTarget(factory.Object);

            var info = await target.Get(1);

            info.Should().NotBeNull();
            info!.Preview.Should().Be("Reentrancy Bug");
            info.FullContent.Should().Be("Reentrancy Bug\n\nDetailed description here");
            info.AuthorUserId.Should().Be(42);
            info.IsHidden.Should().BeFalse();
            info.IsDeleted.Should().BeFalse();
        }

        [Fact]
        public async Task Vulnerability_Get_Returns_Null_ForMissingId()
        {
            var (factory, _) = BuildVulnerabilityFactory(new List<VulnerabilityModel>());
            var target = new VulnerabilityModerationTarget(factory.Object);

            var info = await target.Get(999);

            info.Should().BeNull();
        }

        [Fact]
        public async Task Vulnerability_Get_FullContent_UsesTitle_WhenDescriptionEmpty()
        {
            var vuln = new VulnerabilityModel { Id = 2, Title = "Title Only", Description = "", CreatedBy = 1 };
            var (factory, _) = BuildVulnerabilityFactory(new List<VulnerabilityModel> { vuln });
            var target = new VulnerabilityModerationTarget(factory.Object);

            var info = await target.Get(2);

            info!.FullContent.Should().Be("Title Only");
        }

        [Fact]
        public async Task Vulnerability_Hide_Sets_IsHidden_True_And_SaveChanges()
        {
            var vuln = new VulnerabilityModel { Id = 1, Title = "T", CreatedBy = 1, IsHidden = false };
            var list = new List<VulnerabilityModel> { vuln };
            var (factory, dbMock) = BuildVulnerabilityFactory(list);
            var target = new VulnerabilityModerationTarget(factory.Object);

            await target.Hide(1);

            vuln.IsHidden.Should().BeTrue();
            dbMock.Verify(d => d.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task Vulnerability_SoftDelete_Sets_IsDeleted_True_And_SaveChanges()
        {
            var vuln = new VulnerabilityModel { Id = 1, Title = "T", CreatedBy = 1, IsDeleted = false };
            var list = new List<VulnerabilityModel> { vuln };
            var (factory, dbMock) = BuildVulnerabilityFactory(list);
            var target = new VulnerabilityModerationTarget(factory.Object);

            await target.SoftDelete(1);

            vuln.IsDeleted.Should().BeTrue();
            dbMock.Verify(d => d.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task Vulnerability_Restore_Clears_BothHiddenAndDeleted()
        {
            // An item that is both hidden AND soft-deleted: Restore (the "approve" action)
            // must fully un-suppress it — both flags become false.
            var vuln = new VulnerabilityModel { Id = 1, Title = "T", CreatedBy = 1, IsHidden = true, IsDeleted = true };
            var list = new List<VulnerabilityModel> { vuln };
            var (factory, _) = BuildVulnerabilityFactory(list);
            var target = new VulnerabilityModerationTarget(factory.Object);

            await target.Restore(1);

            vuln.IsHidden.Should().BeFalse();
            vuln.IsDeleted.Should().BeFalse();
        }

        [Fact]
        public async Task Vulnerability_ContentType_Is_Vulnerability()
        {
            var (factory, _) = BuildVulnerabilityFactory(new List<VulnerabilityModel>());
            var target = new VulnerabilityModerationTarget(factory.Object);

            target.ContentType.Should().Be(ModeratedContentType.Vulnerability);
        }

        // --- ReportModerationTarget tests ---

        [Fact]
        public async Task Report_Get_Returns_MappedInfo_ForExistingId()
        {
            var report = new ReportModel
            {
                Id = 10,
                Name = "Audit Report 2025",
                CreatedBy = 7,
                IsHidden = false,
                IsDeleted = false
            };
            var (factory, _) = BuildReportFactory(new List<ReportModel> { report });
            var target = new ReportModerationTarget(factory.Object);

            var info = await target.Get(10);

            info.Should().NotBeNull();
            info!.Preview.Should().Be("Audit Report 2025");
            info.FullContent.Should().Be("Audit Report 2025");
            info.AuthorUserId.Should().Be(7);
        }

        [Fact]
        public async Task Report_Get_Returns_Null_ForMissingId()
        {
            var (factory, _) = BuildReportFactory(new List<ReportModel>());
            var target = new ReportModerationTarget(factory.Object);

            var info = await target.Get(999);

            info.Should().BeNull();
        }

        [Fact]
        public async Task Report_ContentType_Is_Report()
        {
            var (factory, _) = BuildReportFactory(new List<ReportModel>());
            var target = new ReportModerationTarget(factory.Object);

            target.ContentType.Should().Be(ModeratedContentType.Report);
        }

        // --- ModerationTargetRegistry tests ---

        [Fact]
        public void Registry_Resolves_TargetsByContentType()
        {
            // No DB call happens during construction or lookup, so a bare factory mock is fine.
            var factory = new Mock<IDbContextFactory<Db>>().Object;
            var registry = new ModerationTargetRegistry(new IModerationTarget[]
            {
                new VulnerabilityModerationTarget(factory),
                new ReportModerationTarget(factory)
            });

            registry.Get(ModeratedContentType.Vulnerability).ContentType.Should().Be(ModeratedContentType.Vulnerability);
            registry.Get(ModeratedContentType.Report).ContentType.Should().Be(ModeratedContentType.Report);

            registry.TryGet(ModeratedContentType.Report, out var t).Should().BeTrue();
            t.ContentType.Should().Be(ModeratedContentType.Report);
        }
    }
}

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
    public class CommentProcessorTests
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
            m.Setup(d => d.Add(It.IsAny<T>())).Callback<T>(source.Add);
            return m;
        }

        private static Mock<IDbContextFactory<Db>> BuildFactory(List<CommentModel> list, out Mock<Db> dbMock)
        {
            dbMock = new Mock<Db>(
                new Mock<IDbQuery>().Object,
                new Mock<Microsoft.Extensions.Logging.ILogger<Db>>().Object,
                new Mock<IDataSourceProvider>().Object) { CallBase = true };
            dbMock.Setup(d => d.Comment).Returns(CreateDbSetMock(list).Object);
            dbMock.Setup(d => d.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

            var factory = new Mock<IDbContextFactory<Db>>();
            factory.Setup(f => f.CreateDbContextAsync(It.IsAny<CancellationToken>())).ReturnsAsync(dbMock.Object);
            return factory;
        }

        [Fact]
        public async Task Add_Persists_And_Returns_Comment()
        {
            var list = new List<CommentModel>();
            var factory = BuildFactory(list, out var dbMock);
            var processor = new CommentProcessor(factory.Object);

            var result = await processor.Add(new CommentModel
            {
                AuthorId = 7, EntityType = EntityType.Vulnerability, EntityId = 50, Content = "First!"
            });

            result.Content.Should().Be("First!");
            list.Should().ContainSingle();
            dbMock.Verify(d => d.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task Get_Returns_Comment_ById()
        {
            var list = new List<CommentModel> { new() { Id = 3, AuthorId = 1, Content = "hi" } };
            var processor = new CommentProcessor(BuildFactory(list, out _).Object);

            (await processor.Get(3))!.Content.Should().Be("hi");
        }

        [Fact]
        public async Task Get_Returns_Null_For_MissingId()
        {
            var processor = new CommentProcessor(BuildFactory(new List<CommentModel>(), out _).Object);
            (await processor.Get(999)).Should().BeNull();
        }

        [Fact]
        public async Task ListByEntity_Returns_TopLevel_Visible_Oldest_First_AndExcludesHiddenDeleted()
        {
            var list = new List<CommentModel>
            {
                new() { Id = 1, EntityType = EntityType.Report, EntityId = 9, Content = "a", CreatedAt = new DateTime(2026,1,1) },
                new() { Id = 2, EntityType = EntityType.Report, EntityId = 9, Content = "b", CreatedAt = new DateTime(2026,1,2) },
                new() { Id = 3, EntityType = EntityType.Report, EntityId = 9, Content = "hidden", IsHidden = true },
                new() { Id = 4, EntityType = EntityType.Report, EntityId = 9, Content = "deleted", IsDeleted = true },
                new() { Id = 5, EntityType = EntityType.Report, EntityId = 9, Content = "reply", ParentCommentId = 1 },
                new() { Id = 6, EntityType = EntityType.Vulnerability, EntityId = 9, Content = "other-entity" },
            };
            var processor = new CommentProcessor(BuildFactory(list, out _).Object);

            var page = await processor.ListByEntity(EntityType.Report, 9, page: 1, pageSize: 20, includeSuppressed: false);

            page.Select(c => c.Id).Should().Equal(1, 2); // top-level, visible, this entity, oldest-first; no reply/hidden/deleted/other-entity
        }

        [Fact]
        public async Task SoftDelete_Sets_Flag_And_DeletedAt()
        {
            var c = new CommentModel { Id = 8, Content = "x", IsDeleted = false };
            var processor = new CommentProcessor(BuildFactory(new List<CommentModel> { c }, out var dbMock).Object);

            await processor.SoftDelete(8);

            c.IsDeleted.Should().BeTrue();
            c.DeletedAt.Should().NotBeNull();
            dbMock.Verify(d => d.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task ListByEntity_Includes_Suppressed_When_IncludeSuppressed_True()
        {
            var list = new List<CommentModel>
            {
                new() { Id = 1, EntityType = EntityType.Report, EntityId = 9, Content = "visible", CreatedAt = new DateTime(2026,1,1) },
                new() { Id = 2, EntityType = EntityType.Report, EntityId = 9, Content = "hidden", IsHidden = true, CreatedAt = new DateTime(2026,1,2) },
                new() { Id = 3, EntityType = EntityType.Report, EntityId = 9, Content = "deleted", IsDeleted = true, CreatedAt = new DateTime(2026,1,3) },
            };
            var processor = new CommentProcessor(BuildFactory(list, out _).Object);

            var page = await processor.ListByEntity(EntityType.Report, 9, page: 1, pageSize: 20, includeSuppressed: true);

            page.Select(c => c.Id).Should().Equal(1, 2, 3);
        }

        [Fact]
        public async Task SoftDelete_NoOps_When_Comment_Missing()
        {
            var processor = new CommentProcessor(BuildFactory(new List<CommentModel>(), out var dbMock).Object);

            await processor.SoftDelete(999); // must not throw

            dbMock.Verify(d => d.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
        }

        private static Mock<IDbContextFactory<Db>> BuildFullFactory(
            List<CommentModel> comments,
            List<VulnerabilityModel>? vulns = null,
            List<ReportModel>? reports = null,
            List<LoginModel>? logins = null)
        {
            var dbMock = new Mock<Db>(
                new Mock<IDbQuery>().Object,
                new Mock<Microsoft.Extensions.Logging.ILogger<Db>>().Object,
                new Mock<IDataSourceProvider>().Object) { CallBase = true };
            dbMock.Setup(d => d.Comment).Returns(CreateDbSetMock(comments).Object);
            dbMock.Setup(d => d.Vulnerability).Returns(CreateDbSetMock(vulns ?? new()).Object);
            dbMock.Setup(d => d.Report).Returns(CreateDbSetMock(reports ?? new()).Object);
            // Login is not virtual — assign directly on the mock object.
            dbMock.Object.Login = CreateDbSetMock(logins ?? new()).Object;
            dbMock.Setup(d => d.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

            var factory = new Mock<IDbContextFactory<Db>>();
            factory.Setup(f => f.CreateDbContextAsync(It.IsAny<CancellationToken>())).ReturnsAsync(dbMock.Object);
            return factory;
        }

        [Fact]
        public async Task CountByEntity_Counts_Visible_AllLevels_ForEntity()
        {
            var list = new List<CommentModel>
            {
                new() { Id = 1, EntityType = EntityType.Report, EntityId = 9, Content = "top" },
                new() { Id = 2, EntityType = EntityType.Report, EntityId = 9, Content = "reply", ParentCommentId = 1 },
                new() { Id = 3, EntityType = EntityType.Report, EntityId = 9, Content = "hidden", IsHidden = true },
                new() { Id = 4, EntityType = EntityType.Report, EntityId = 9, Content = "deleted", IsDeleted = true },
                new() { Id = 5, EntityType = EntityType.Vulnerability, EntityId = 9, Content = "other" },
            };
            var processor = new CommentProcessor(BuildFullFactory(list).Object);

            (await processor.CountByEntity(EntityType.Report, 9)).Should().Be(2); // top + reply, excludes hidden/deleted/other-entity
        }

        [Fact]
        public async Task ListReplies_Returns_Visible_Replies_For_Parents_OldestFirst()
        {
            var list = new List<CommentModel>
            {
                new() { Id = 10, EntityType = EntityType.Report, EntityId = 9, Content = "r1", ParentCommentId = 1, CreatedAt = new DateTime(2026,1,2) },
                new() { Id = 11, EntityType = EntityType.Report, EntityId = 9, Content = "r0", ParentCommentId = 1, CreatedAt = new DateTime(2026,1,1) },
                new() { Id = 12, EntityType = EntityType.Report, EntityId = 9, Content = "hidden", ParentCommentId = 1, IsHidden = true },
                new() { Id = 13, EntityType = EntityType.Report, EntityId = 9, Content = "other-parent", ParentCommentId = 2 },
            };
            var processor = new CommentProcessor(BuildFullFactory(list).Object);

            var replies = await processor.ListReplies(EntityType.Report, 9, new List<int> { 1 });

            replies.Select(c => c.Id).Should().Equal(11, 10); // parent 1, visible, oldest-first; excludes hidden + other parent
        }

        [Fact]
        public async Task ListReplies_Returns_Empty_When_No_Parents()
        {
            var processor = new CommentProcessor(BuildFullFactory(new List<CommentModel>()).Object);
            (await processor.ListReplies(EntityType.Report, 9, new List<int>())).Should().BeEmpty();
        }

        [Fact]
        public async Task EntityExists_True_For_Existing_Report_And_Vulnerability()
        {
            var processor = new CommentProcessor(BuildFullFactory(
                new List<CommentModel>(),
                vulns: new List<VulnerabilityModel> { new() { Id = 7, Title = "v" } },
                reports: new List<ReportModel> { new() { Id = 8, Name = "r" } }).Object);

            (await processor.EntityExists(EntityType.Vulnerability, 7)).Should().BeTrue();
            (await processor.EntityExists(EntityType.Report, 8)).Should().BeTrue();
            (await processor.EntityExists(EntityType.Report, 999)).Should().BeFalse();
            (await processor.EntityExists(EntityType.Protocol, 1)).Should().BeFalse();
        }

        [Fact]
        public async Task GetAuthorNames_Prefers_FullName_Falls_Back_To_Login()
        {
            var processor = new CommentProcessor(BuildFullFactory(
                new List<CommentModel>(),
                logins: new List<LoginModel>
                {
                    new() { LoginId = 1, FullName = "Alice A", Login = "alice" },
                    new() { LoginId = 2, FullName = "", Login = "bob" },
                }).Object);

            var names = await processor.GetAuthorNames(new List<int> { 1, 2 });

            names[1].Should().Be("Alice A");
            names[2].Should().Be("bob");
        }
    }
}

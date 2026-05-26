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
    }
}

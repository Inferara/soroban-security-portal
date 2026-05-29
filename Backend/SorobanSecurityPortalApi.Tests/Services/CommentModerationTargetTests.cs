using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;
using Moq;
using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Services.Moderation;
using Xunit;

namespace SorobanSecurityPortalApi.Tests.Services
{
    public class CommentModerationTargetTests
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

        private static (Mock<IDbContextFactory<Db>> factory, Mock<IDistributedCache> cache) Build(List<CommentModel> list)
        {
            var dbMock = new Mock<Db>(
                new Mock<IDbQuery>().Object,
                new Mock<Microsoft.Extensions.Logging.ILogger<Db>>().Object,
                new Mock<IDataSourceProvider>().Object) { CallBase = true };
            dbMock.Setup(d => d.Comment).Returns(CreateDbSetMock(list).Object);
            dbMock.Setup(d => d.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

            var factory = new Mock<IDbContextFactory<Db>>();
            factory.Setup(f => f.CreateDbContextAsync(It.IsAny<CancellationToken>())).ReturnsAsync(dbMock.Object);
            return (factory, new Mock<IDistributedCache>());
        }

        [Fact]
        public async Task ContentType_Is_Comment()
        {
            var (factory, cache) = Build(new List<CommentModel>());
            new CommentModerationTarget(factory.Object, cache.Object).ContentType.Should().Be(ModeratedContentType.Comment);
        }

        [Fact]
        public async Task Get_Returns_MappedInfo()
        {
            var c = new CommentModel { Id = 5, AuthorId = 42, EntityType = EntityType.Vulnerability, EntityId = 50, Content = "Looks exploitable", IsHidden = false, IsDeleted = false };
            var (factory, cache) = Build(new List<CommentModel> { c });
            var info = await new CommentModerationTarget(factory.Object, cache.Object).Get(5);

            info.Should().NotBeNull();
            info!.Preview.Should().Be("Looks exploitable");
            info.FullContent.Should().Be("Looks exploitable");
            info.AuthorUserId.Should().Be(42);
        }

        [Fact]
        public async Task Get_Returns_Null_For_MissingId()
        {
            var (factory, cache) = Build(new List<CommentModel>());
            (await new CommentModerationTarget(factory.Object, cache.Object).Get(999)).Should().BeNull();
        }

        [Fact]
        public async Task Hide_Sets_IsHidden_And_Invalidates_CountCache()
        {
            var c = new CommentModel { Id = 5, EntityType = EntityType.Report, EntityId = 7, IsHidden = false };
            var (factory, cache) = Build(new List<CommentModel> { c });
            await new CommentModerationTarget(factory.Object, cache.Object).Hide(5);

            c.IsHidden.Should().BeTrue();
            cache.Verify(x => x.RemoveAsync(CommentCacheKeys.Count(EntityType.Report, 7), It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task Restore_Clears_BothFlags()
        {
            var c = new CommentModel { Id = 5, EntityType = EntityType.Report, EntityId = 7, IsHidden = true, IsDeleted = true };
            var (factory, cache) = Build(new List<CommentModel> { c });
            await new CommentModerationTarget(factory.Object, cache.Object).Restore(5);

            c.IsHidden.Should().BeFalse();
            c.IsDeleted.Should().BeFalse();
        }

        [Fact]
        public async Task SoftDelete_Sets_IsDeleted()
        {
            var c = new CommentModel { Id = 5, EntityType = EntityType.Report, EntityId = 7, IsDeleted = false };
            var (factory, cache) = Build(new List<CommentModel> { c });
            await new CommentModerationTarget(factory.Object, cache.Object).SoftDelete(5);

            c.IsDeleted.Should().BeTrue();
        }
    }
}

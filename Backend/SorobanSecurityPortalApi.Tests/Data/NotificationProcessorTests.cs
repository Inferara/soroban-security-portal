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
    public class NotificationProcessorTests
    {
        private static Mock<DbSet<T>> Set<T>(List<T> src) where T : class
        {
            var q = src.AsQueryable();
            var m = new Mock<DbSet<T>>();
            m.As<IQueryable<T>>().Setup(x => x.Provider).Returns(new TestAsyncQueryProvider<T>(q.Provider));
            m.As<IQueryable<T>>().Setup(x => x.Expression).Returns(q.Expression);
            m.As<IQueryable<T>>().Setup(x => x.ElementType).Returns(q.ElementType);
            m.As<IQueryable<T>>().Setup(x => x.GetEnumerator()).Returns(q.GetEnumerator());
            m.As<IAsyncEnumerable<T>>().Setup(x => x.GetAsyncEnumerator(It.IsAny<CancellationToken>()))
                .Returns(new TestAsyncEnumerator<T>(q.GetEnumerator()));
            m.Setup(d => d.Add(It.IsAny<T>())).Callback<T>(src.Add);
            m.Setup(d => d.AddRange(It.IsAny<IEnumerable<T>>())).Callback<IEnumerable<T>>(src.AddRange);
            return m;
        }

        private static Mock<IDbContextFactory<Db>> Factory(List<NotificationModel> rows, out Mock<Db> dbMock)
        {
            dbMock = new Mock<Db>(
                new Mock<IDbQuery>().Object,
                new Mock<Microsoft.Extensions.Logging.ILogger<Db>>().Object,
                new Mock<IDataSourceProvider>().Object) { CallBase = true };
            dbMock.Setup(d => d.Notification).Returns(Set(rows).Object);
            dbMock.Setup(d => d.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
            var f = new Mock<IDbContextFactory<Db>>();
            f.Setup(x => x.CreateDbContextAsync(It.IsAny<CancellationToken>())).ReturnsAsync(dbMock.Object);
            return f;
        }

        private static NotificationModel N(int id, int recipient, bool read = false, NotificationType type = NotificationType.Mention, DateTime created = default)
            => new() { Id = id, RecipientUserId = recipient, IsRead = read, Type = type, ActorUserId = 1, CommentId = 1, EntityType = EntityType.Report, EntityId = 1, CreatedAt = created == default ? DateTime.UtcNow : created };

        [Fact]
        public async Task AddRange_Persists_All()
        {
            var rows = new List<NotificationModel>();
            var f = Factory(rows, out var db);
            await new NotificationProcessor(f.Object).AddRange(new[] { N(0, 5), N(0, 6) });
            rows.Should().HaveCount(2);
            db.Verify(d => d.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task ListForUser_Returns_Newest_First_Filtered_By_User()
        {
            var rows = new List<NotificationModel>
            {
                N(1, 5, created: new DateTime(2026,1,1)),
                N(2, 5, created: new DateTime(2026,1,3)),
                N(3, 6, created: new DateTime(2026,1,2)), // other user
            };
            var page = await new NotificationProcessor(Factory(rows, out _).Object).ListForUser(5, null, 1, 20);
            page.Select(n => n.Id).Should().Equal(2, 1); // user 5 only, newest first
        }

        [Fact]
        public async Task ListForUser_Filters_By_Type()
        {
            var rows = new List<NotificationModel>
            {
                N(1, 5, type: NotificationType.Mention),
                N(2, 5, type: NotificationType.CommentReply),
            };
            var page = await new NotificationProcessor(Factory(rows, out _).Object).ListForUser(5, NotificationType.Mention, 1, 20);
            page.Select(n => n.Id).Should().Equal(1);
        }

        [Fact]
        public async Task UnreadCount_Counts_Only_Unread_For_User()
        {
            var rows = new List<NotificationModel> { N(1, 5, read: false), N(2, 5, read: true), N(3, 6, read: false) };
            (await new NotificationProcessor(Factory(rows, out _).Object).UnreadCount(5)).Should().Be(1);
        }

        [Fact]
        public async Task MarkRead_Sets_Flag_Only_For_Owner()
        {
            var mine = N(1, 5); var notMine = N(2, 6);
            var f = new NotificationProcessor(Factory(new List<NotificationModel> { mine, notMine }, out _).Object);
            await f.MarkRead(1, 5);
            await f.MarkRead(2, 5); // not owner → no-op
            mine.IsRead.Should().BeTrue();
            notMine.IsRead.Should().BeFalse();
        }

        [Fact]
        public async Task MarkAllRead_Sets_All_For_User()
        {
            var rows = new List<NotificationModel> { N(1, 5, read: false), N(2, 5, read: false), N(3, 6, read: false) };
            await new NotificationProcessor(Factory(rows, out _).Object).MarkAllRead(5);
            rows.Where(n => n.RecipientUserId == 5).All(n => n.IsRead).Should().BeTrue();
            rows.Single(n => n.RecipientUserId == 6).IsRead.Should().BeFalse();
        }
    }
}

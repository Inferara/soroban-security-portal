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
    public class MentionProcessorTests
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
            m.Setup(d => d.RemoveRange(It.IsAny<IEnumerable<T>>())).Callback<IEnumerable<T>>(items => { foreach (var i in items.ToList()) src.Remove(i); });
            return m;
        }

        private static Mock<IDbContextFactory<Db>> Factory(List<MentionModel> mentions, List<LoginModel> logins)
        {
            var db = new Mock<Db>(
                new Mock<IDbQuery>().Object,
                new Mock<Microsoft.Extensions.Logging.ILogger<Db>>().Object,
                new Mock<IDataSourceProvider>().Object) { CallBase = true };
            db.Setup(d => d.Mention).Returns(Set(mentions).Object);
            db.Object.Login = Set(logins).Object; // Login is not virtual
            db.Setup(d => d.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
            var f = new Mock<IDbContextFactory<Db>>();
            f.Setup(x => x.CreateDbContextAsync(It.IsAny<CancellationToken>())).ReturnsAsync(db.Object);
            return f;
        }

        [Fact]
        public async Task Resolves_Known_Usernames_And_Stores_Mentions()
        {
            var mentions = new List<MentionModel>();
            var logins = new List<LoginModel> { new() { LoginId = 11, Login = "alice" }, new() { LoginId = 22, Login = "bob" } };
            var proc = new MentionProcessor(Factory(mentions, logins).Object);

            var ids = await proc.ReplaceCommentMentions(commentId: 5, "hi @alice and @bob and @ghost");

            ids.Should().BeEquivalentTo(new[] { 11, 22 });           // @ghost unresolved → skipped
            mentions.Should().HaveCount(2);
            mentions.Select(m => m.MentionedUserId).Should().BeEquivalentTo(new[] { 11, 22 });
            mentions.All(m => m.CommentId == 5).Should().BeTrue();
        }

        [Fact]
        public async Task Replaces_Existing_Mentions_For_The_Comment()
        {
            var mentions = new List<MentionModel> { new() { Id = 1, CommentId = 5, MentionedUserId = 99, StartPos = 0, EndPos = 3 } };
            var logins = new List<LoginModel> { new() { LoginId = 11, Login = "alice" } };
            var proc = new MentionProcessor(Factory(mentions, logins).Object);

            var ids = await proc.ReplaceCommentMentions(5, "now only @alice");

            ids.Should().Equal(11);
            mentions.Should().ContainSingle();
            mentions[0].MentionedUserId.Should().Be(11); // old (99) removed, new (11) added
        }

        [Fact]
        public async Task No_Mentions_Clears_Existing_And_Returns_Empty()
        {
            var mentions = new List<MentionModel> { new() { Id = 1, CommentId = 5, MentionedUserId = 99 } };
            var proc = new MentionProcessor(Factory(mentions, new List<LoginModel>()).Object);

            var ids = await proc.ReplaceCommentMentions(5, "no mentions here");

            ids.Should().BeEmpty();
            mentions.Should().BeEmpty();
        }
    }
}

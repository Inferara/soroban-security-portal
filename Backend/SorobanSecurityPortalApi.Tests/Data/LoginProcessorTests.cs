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
    public class LoginProcessorTests
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
            return m;
        }

        private static LoginProcessor Build(List<LoginModel> logins)
        {
            var db = new Mock<Db>(
                new Mock<IDbQuery>().Object,
                new Mock<Microsoft.Extensions.Logging.ILogger<Db>>().Object,
                new Mock<IDataSourceProvider>().Object) { CallBase = true };
            db.Object.Login = Set(logins).Object;
            var f = new Mock<IDbContextFactory<Db>>();
            f.Setup(x => x.CreateDbContextAsync(It.IsAny<CancellationToken>())).ReturnsAsync(db.Object);
            return new LoginProcessor(f.Object);
        }

        [Fact]
        public async Task SearchUsers_Matches_Username_Or_FullName_CaseInsensitive_Limited()
        {
            var logins = new List<LoginModel>
            {
                new() { LoginId = 1, Login = "alice", FullName = "Alice Adams", IsEnabled = true },
                new() { LoginId = 2, Login = "bob", FullName = "Bob Brown", IsEnabled = true },
                new() { LoginId = 3, Login = "carol", FullName = "Alicia Carter", IsEnabled = true }, // matches "ali" via FullName
            };
            var res = await Build(logins).SearchUsers("ALI", 5);
            res.Select(l => l.LoginId).Should().BeEquivalentTo(new[] { 1, 3 });
        }

        [Fact]
        public async Task SearchUsers_Empty_Query_Returns_Empty()
        {
            (await Build(new List<LoginModel> { new() { LoginId = 1, Login = "alice", FullName = "A", IsEnabled = true } }).SearchUsers("  ", 5))
                .Should().BeEmpty();
        }

        [Fact]
        public async Task SearchUsers_Respects_Limit()
        {
            var logins = Enumerable.Range(1, 10).Select(i => new LoginModel { LoginId = i, Login = $"user{i}", FullName = "X", IsEnabled = true }).ToList();
            (await Build(logins).SearchUsers("user", 5)).Should().HaveCount(5);
        }

        [Fact]
        public async Task SearchUsers_Excludes_Disabled_Users()
        {
            var logins = new List<LoginModel>
            {
                new() { LoginId = 1, Login = "alice", FullName = "Alice Adams", IsEnabled = true },
                new() { LoginId = 2, Login = "alice2", FullName = "Alice Disabled", IsEnabled = false },
            };
            var res = await Build(logins).SearchUsers("alice", 5);
            res.Select(l => l.LoginId).Should().BeEquivalentTo(new[] { 1 });
        }
    }
}

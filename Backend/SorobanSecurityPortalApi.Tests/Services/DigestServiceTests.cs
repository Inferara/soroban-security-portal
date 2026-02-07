using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Query;
using Microsoft.Extensions.Logging;
using Moq;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Services;
using SorobanSecurityPortalApi.Services.ProcessingServices;
using Xunit;

namespace SorobanSecurityPortalApi.Tests.Services
{
    public class DigestServiceTests
    {
        private readonly Mock<Db> _dbMock;
        private readonly Mock<IEmailService> _emailServiceMock;
        private readonly Mock<ILogger<DigestService>> _loggerMock;
        private readonly Config _realConfig;
        private readonly DigestService _service;

        private readonly List<ReportModel> _reportsData = new();
        private readonly List<VulnerabilityModel> _vulnsData = new();
        private readonly List<ForumThreadModel> _threadsData = new();
        private readonly List<UserProfileModel> _usersData = new();
        private readonly List<SubscriptionModel> _subsData = new();

        private readonly Mock<IDbQuery> _dbQueryMock = new();
        private readonly Mock<ILogger<Db>> _dbLoggerMock = new();
        private readonly Mock<IDataSourceProvider> _dsProviderMock = new();

        public DigestServiceTests()
        {
            _dbMock = new Mock<Db>(_dbQueryMock.Object, _dbLoggerMock.Object, _dsProviderMock.Object) { CallBase = true };
            _dbMock.Object.Report = CreateDbSetMock(_reportsData).Object;
            _dbMock.Object.Vulnerability = CreateDbSetMock(_vulnsData).Object;
            _dbMock.Object.ForumThread = CreateDbSetMock(_threadsData).Object;
            _dbMock.Object.UserProfiles = CreateDbSetMock(_usersData).Object;
            _dbMock.Object.Subscription = CreateDbSetMock(_subsData).Object;
            _dbMock.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

            _emailServiceMock = new Mock<IEmailService>();
            _loggerMock = new Mock<ILogger<DigestService>>();

            // Full Config Mock
            var dummyAppSettings = @"
            {
                ""ProductVersion"": ""1.0"", ""DbConnectionTimeout"": 30, ""DbServer"": ""localhost"", ""DbPort"": 5432, ""DbName"": ""test_db"",
                ""DbUser"": ""test_user"", ""DbPassword"": ""test_pass"", ""DbTimeout"": 30, ""DbPgPoolSize"": 10, ""AutoCompactLargeObjectHeap"": false,
                ""DistributedCacheUrl"": ""localhost"", ""DistributedCachePassword"": ""pass"", ""AppUrl"": ""http://localhost:5000"",
                ""FrontendUrl"": ""http://test-portal.com"", ""DigestDayOfWeek"": ""Friday"", ""DigestHourUtc"": 9
            }";
            _realConfig = new Config(dummyAppSettings);

            _service = new DigestService(_dbMock.Object, _emailServiceMock.Object, _realConfig, _loggerMock.Object);
        }

        [Fact]
        public async Task ProcessDigestsAsync_Should_Include_Protocol_And_Category_Content()
        {
            var user = new UserProfileModel { LoginId = 1, ReceiveWeeklyDigest = true, Login = new LoginModel { LoginId = 1, Email = "u1@test.com", IsEnabled = true, FullName = "U1" } };
            _usersData.Add(user);

            _subsData.Add(new SubscriptionModel { UserId = 1, ProtocolId = 5 });
            _subsData.Add(new SubscriptionModel { UserId = 1, CategoryId = 10 });

            var report = new ReportModel { Id = 100, ProtocolId = 5 };
            _vulnsData.Add(new VulnerabilityModel { Date = DateTime.UtcNow.AddDays(-1), Title = "Vuln for Protocol 5", Report = report, ReportId = 100 });
            _threadsData.Add(new ForumThreadModel { CreatedAt = DateTime.UtcNow.AddDays(-1), Title = "Discussion in Category 10", CategoryId = 10, ViewCount = 50 });
            var report99 = new ReportModel { Id = 200, ProtocolId = 99 };
            _vulnsData.Add(new VulnerabilityModel { Date = DateTime.UtcNow.AddDays(-1), Title = "Noise Vuln", Report = report99, ReportId = 200 });

            await _service.ProcessDigestsAsync();

            _emailServiceMock.Verify(x => x.SendEmailAsync("u1@test.com", It.IsAny<string>(), It.Is<string>(b => b.Contains("Vuln for Protocol 5") && b.Contains("Discussion in Category 10") && !b.Contains("Noise Vuln"))), Times.Once);
        }

        [Fact]
        public async Task ProcessDigestsAsync_Should_DoNothing_When_NoNewContent()
        {
            _reportsData.Add(new ReportModel { Date = DateTime.UtcNow.AddDays(-8), Name = "Old Report", ProtocolId = 1 });
            _usersData.Add(new UserProfileModel { LoginId = 1, ReceiveWeeklyDigest = true, Login = new LoginModel { LoginId = 1, Email = "u1@test.com", IsEnabled = true } });
            _subsData.Add(new SubscriptionModel { UserId = 1, ProtocolId = 1 });

            await _service.ProcessDigestsAsync();
            _emailServiceMock.Verify(x => x.SendEmailAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task ProcessDigestsAsync_Should_SkipUser_If_OptedOut()
        {
            _usersData.Add(new UserProfileModel { LoginId = 1, ReceiveWeeklyDigest = false, Login = new LoginModel { LoginId = 1, Email = "optout@test.com", IsEnabled = true } });
            _subsData.Add(new SubscriptionModel { UserId = 1, ProtocolId = 1 });
            _reportsData.Add(new ReportModel { Date = DateTime.UtcNow.AddDays(-1), Name = "New Report", ProtocolId = 1 });

            await _service.ProcessDigestsAsync();
            _emailServiceMock.Verify(x => x.SendEmailAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task ProcessDigestsAsync_Should_SkipUser_If_SentRecently()
        {
            _usersData.Add(new UserProfileModel { LoginId = 1, ReceiveWeeklyDigest = true, LastDigestSentAt = DateTime.UtcNow.AddDays(-2), Login = new LoginModel { LoginId = 1, Email = "recent@test.com", IsEnabled = true } });
            _subsData.Add(new SubscriptionModel { UserId = 1, ProtocolId = 1 });
            _reportsData.Add(new ReportModel { Date = DateTime.UtcNow.AddDays(-1), Name = "New Report", ProtocolId = 1 });

            await _service.ProcessDigestsAsync();
            _emailServiceMock.Verify(x => x.SendEmailAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task ProcessDigestsAsync_Should_Continue_To_NextUser_On_Error()
        {
            _usersData.Add(new UserProfileModel { LoginId = 1, ReceiveWeeklyDigest = true, Login = new LoginModel { LoginId = 1, Email = "bad@test.com", IsEnabled = true } });
            _usersData.Add(new UserProfileModel { LoginId = 2, ReceiveWeeklyDigest = true, Login = new LoginModel { LoginId = 2, Email = "good@test.com", IsEnabled = true } });
            _subsData.Add(new SubscriptionModel { UserId = 1, ProtocolId = 1 });
            _subsData.Add(new SubscriptionModel { UserId = 2, ProtocolId = 1 });
            _reportsData.Add(new ReportModel { Date = DateTime.UtcNow.AddDays(-1), Name = "New Report", ProtocolId = 1 });

            _emailServiceMock.Setup(x => x.SendEmailAsync("bad@test.com", It.IsAny<string>(), It.IsAny<string>())).ThrowsAsync(new Exception("SMTP Failure"));

            await _service.ProcessDigestsAsync();
            _emailServiceMock.Verify(x => x.SendEmailAsync("good@test.com", It.IsAny<string>(), It.IsAny<string>()), Times.Once);
        }

        [Fact]
        public async Task ProcessDigestsAsync_Should_Format_Partial_Content_Correctly()
        {
            _usersData.Add(new UserProfileModel { LoginId = 1, ReceiveWeeklyDigest = true, Login = new LoginModel { LoginId = 1, Email = "partial@test.com", IsEnabled = true } });
            _subsData.Add(new SubscriptionModel { UserId = 1, CategoryId = 10 });
            _threadsData.Add(new ForumThreadModel { CreatedAt = DateTime.UtcNow.AddDays(-1), Title = "New Discussion", CategoryId = 10 });

            await _service.ProcessDigestsAsync();
            _emailServiceMock.Verify(x => x.SendEmailAsync("partial@test.com", It.IsAny<string>(), It.Is<string>(b => b.Contains("New Discussion") && !b.Contains("New Audit Reports") && !b.Contains("New Vulnerabilities"))), Times.Once);
        }

        private static Mock<DbSet<T>> CreateDbSetMock<T>(List<T> sourceList) where T : class
        {
            var queryable = sourceList.AsQueryable();
            var dbSetMock = new Mock<DbSet<T>>();
            dbSetMock.As<IQueryable<T>>().Setup(m => m.Provider).Returns(new TestAsyncQueryProvider<T>(queryable.Provider));
            dbSetMock.As<IQueryable<T>>().Setup(m => m.Expression).Returns(queryable.Expression);
            dbSetMock.As<IQueryable<T>>().Setup(m => m.ElementType).Returns(queryable.ElementType);
            dbSetMock.As<IQueryable<T>>().Setup(m => m.GetEnumerator()).Returns(queryable.GetEnumerator());
            dbSetMock.As<IAsyncEnumerable<T>>().Setup(m => m.GetAsyncEnumerator(It.IsAny<CancellationToken>())).Returns(new TestAsyncEnumerator<T>(queryable.GetEnumerator()));
            return dbSetMock;
        }

        internal class TestAsyncQueryProvider<TEntity> : IAsyncQueryProvider
        {
            private readonly IQueryProvider _inner;
            internal TestAsyncQueryProvider(IQueryProvider inner) => _inner = inner;
            public IQueryable CreateQuery(Expression expression) => new TestAsyncEnumerable<TEntity>(expression);
            public IQueryable<TElement> CreateQuery<TElement>(Expression expression) => new TestAsyncEnumerable<TElement>(expression);
            public object? Execute(Expression expression) => _inner.Execute(expression);
            public TResult Execute<TResult>(Expression expression) => _inner.Execute<TResult>(expression);
            public TResult ExecuteAsync<TResult>(Expression expression, CancellationToken cancellationToken)
            {
                var expectedResultType = typeof(TResult).GetGenericArguments()[0];
                var executionResult = typeof(IQueryProvider).GetMethod(nameof(IQueryProvider.Execute), 1, new[] { typeof(Expression) })!.MakeGenericMethod(expectedResultType).Invoke(this, new[] { expression });
                return (TResult)typeof(Task).GetMethod(nameof(Task.FromResult))!.MakeGenericMethod(expectedResultType).Invoke(null, new[] { executionResult })!;
            }
        }

        internal class TestAsyncEnumerable<T> : EnumerableQuery<T>, IAsyncEnumerable<T>, IQueryable<T>
        {
            public TestAsyncEnumerable(IEnumerable<T> enumerable) : base(enumerable) { }
            public TestAsyncEnumerable(Expression expression) : base(expression) { }
            public IAsyncEnumerator<T> GetAsyncEnumerator(CancellationToken cancellationToken = default) => new TestAsyncEnumerator<T>(this.AsEnumerable().GetEnumerator());
            IQueryProvider IQueryable.Provider => new TestAsyncQueryProvider<T>(this);
        }

        internal class TestAsyncEnumerator<T> : IAsyncEnumerator<T>
        {
            private readonly IEnumerator<T> _inner;
            public TestAsyncEnumerator(IEnumerator<T> inner) => _inner = inner;
            public ValueTask DisposeAsync() { _inner.Dispose(); return ValueTask.CompletedTask; }
            public ValueTask<bool> MoveNextAsync() => ValueTask.FromResult(_inner.MoveNext());
            public T Current => _inner.Current;
        }
    }
}
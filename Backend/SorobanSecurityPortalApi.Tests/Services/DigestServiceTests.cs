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
        private readonly DigestService _service;

        // Mock Data Stores
        private readonly List<ReportModel> _reportsData = new();
        private readonly List<VulnerabilityModel> _vulnsData = new();
        private readonly List<ForumThreadModel> _threadsData = new();
        private readonly List<UserProfileModel> _usersData = new();

        // Dependencies for Mocking Db Constructor
        private readonly Mock<IDbQuery> _dbQueryMock = new();
        private readonly Mock<ILogger<Db>> _dbLoggerMock = new();
        private readonly Mock<IDataSourceProvider> _dsProviderMock = new();

        public DigestServiceTests()
        {
            // Setup Db Mock
            _dbMock = new Mock<Db>(_dbQueryMock.Object, _dbLoggerMock.Object, _dsProviderMock.Object) { CallBase = true };

            _dbMock.Object.Report = CreateDbSetMock(_reportsData).Object;
            _dbMock.Object.Vulnerability = CreateDbSetMock(_vulnsData).Object;
            _dbMock.Object.ForumThread = CreateDbSetMock(_threadsData).Object;
            _dbMock.Object.UserProfiles = CreateDbSetMock(_usersData).Object;

            _dbMock.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

            // Setup Dependencies
            _emailServiceMock = new Mock<IEmailService>();
            _loggerMock = new Mock<ILogger<DigestService>>();

            // Create Service
            _service = new DigestService(_dbMock.Object, _emailServiceMock.Object, _loggerMock.Object);
        }

        [Fact]
        public async Task ProcessDigestsAsync_Should_DoNothing_When_NoNewContent()
        {
            // Add only old content
            _reportsData.Add(new ReportModel { Date = DateTime.UtcNow.AddDays(-8), Name = "Old Report" });

            await _service.ProcessDigestsAsync();

            _emailServiceMock.Verify(x => x.SendEmailAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task ProcessDigestsAsync_Should_SkipUser_If_OptedOut()
        {
            SeedNewContent();
            _usersData.Add(new UserProfileModel 
            { 
                LoginId = 1, 
                ReceiveWeeklyDigest = false, 
                Login = new LoginModel { Email = "optout@test.com", IsEnabled = true }
            });

            await _service.ProcessDigestsAsync();

            _emailServiceMock.Verify(x => x.SendEmailAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task ProcessDigestsAsync_Should_SkipUser_If_SentRecently()
        {
            SeedNewContent();
            _usersData.Add(new UserProfileModel 
            { 
                LoginId = 1, 
                ReceiveWeeklyDigest = true, 
                LastDigestSentAt = DateTime.UtcNow.AddDays(-1), // Too soon
                Login = new LoginModel { Email = "recent@test.com", IsEnabled = true }
            });

            await _service.ProcessDigestsAsync();

            _emailServiceMock.Verify(x => x.SendEmailAsync("recent@test.com", It.IsAny<string>(), It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task ProcessDigestsAsync_Should_SendEmail_When_Valid()
        {
            SeedNewContent();
            var user = new UserProfileModel 
            { 
                LoginId = 10, 
                ReceiveWeeklyDigest = true, 
                LastDigestSentAt = DateTime.UtcNow.AddDays(-8), 
                Login = new LoginModel { Email = "valid@test.com", IsEnabled = true, FullName = "Valid User" }
            };
            _usersData.Add(user);

            await _service.ProcessDigestsAsync();

            _emailServiceMock.Verify(x => x.SendEmailAsync(
                "valid@test.com", 
                It.Is<string>(s => s.Contains("Weekly Soroban")), 
                It.Is<string>(b => b.Contains("New Report") && b.Contains("New Vuln"))
            ), Times.Once);

            // Verify timestamp updated
            user.LastDigestSentAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
        }

        // --- HELPERS ---

        private void SeedNewContent()
        {
            _reportsData.Add(new ReportModel { Date = DateTime.UtcNow.AddDays(-1), Name = "New Report" });
            _vulnsData.Add(new VulnerabilityModel { Date = DateTime.UtcNow.AddDays(-2), Title = "New Vuln" });
        }

        // --- INFRASTRUCTURE ---

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
                var executionResult = typeof(IQueryProvider)
                    .GetMethod(nameof(IQueryProvider.Execute), 1, new[] { typeof(Expression) })!
                    .MakeGenericMethod(expectedResultType)
                    .Invoke(this, new[] { expression });
                return (TResult)typeof(Task).GetMethod(nameof(Task.FromResult))!
                    .MakeGenericMethod(expectedResultType)
                    .Invoke(null, new[] { executionResult })!;
            }
        }

        internal class TestAsyncEnumerable<T> : EnumerableQuery<T>, IAsyncEnumerable<T>, IQueryable<T>
        {
            public TestAsyncEnumerable(IEnumerable<T> enumerable) : base(enumerable) { }
            public TestAsyncEnumerable(Expression expression) : base(expression) { }
            public IAsyncEnumerator<T> GetAsyncEnumerator(CancellationToken cancellationToken = default) =>
                new TestAsyncEnumerator<T>(this.AsEnumerable().GetEnumerator());
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
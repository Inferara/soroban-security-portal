using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using AutoMapper;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Query;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using SorobanSecurityPortalApi.Authorization;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.Mapping;
using SorobanSecurityPortalApi.Models.ViewModels;
using SorobanSecurityPortalApi.Services.ControllersServices;
using Xunit;

namespace SorobanSecurityPortalApi.Tests.Services
{
    public class RatingServiceTests
    {
        private readonly Mock<Db> _dbMock;
        private readonly Mock<DbSet<RatingModel>> _ratingSetMock;
        private readonly Mock<IDistributedCache> _cacheMock;
        private readonly Mock<IHttpContextAccessor> _httpContextAccessorMock;
        private readonly Mock<ILoginProcessor> _loginProcessorMock;
        
        private readonly Mock<IDbQuery> _dbQueryMock;
        private readonly Mock<ILogger<Db>> _loggerMock;
        private readonly Mock<IDataSourceProvider> _dataSourceProviderMock;
        private readonly Mock<IContentFilterService> _contentFilterMock;

        private readonly IMapper _mapper;
        private readonly RatingService _service;
        private readonly List<RatingModel> _dataStore;
        private readonly List<LoginModel> _logins;
        private readonly List<UserProfileModel> _profiles;
        private readonly List<ProtocolModel> _protocols;
        private readonly List<AuditorModel> _auditors;

        public RatingServiceTests()
        {
            // Setup Data Store
            _dataStore = new List<RatingModel>();
            _ratingSetMock = CreateDbSetMock(_dataStore);

            // Sets used by author lookup, weighted average and entity validation.
            _logins = new List<LoginModel>();
            _profiles = new List<UserProfileModel>();
            // Seed the protocols/auditors referenced by the add/update tests so entity
            // validation passes; tests needing a missing entity simply use another id.
            _protocols = new List<ProtocolModel> { new ProtocolModel { Id = 1, Name = "P1" } };
            _auditors = new List<AuditorModel> { new AuditorModel { Id = 1, Name = "A1" } };

            // Mock Db Dependencies
            _dbQueryMock = new Mock<IDbQuery>();
            _loggerMock = new Mock<ILogger<Db>>();
            _dataSourceProviderMock = new Mock<IDataSourceProvider>();

            _dbMock = new Mock<Db>(
                _dbQueryMock.Object, 
                _loggerMock.Object, 
                _dataSourceProviderMock.Object
            ) { CallBase = true };

            _dbMock.Object.Rating = _ratingSetMock.Object;
            _dbMock.Object.Login = CreateDbSetMock(_logins).Object;
            _dbMock.Object.UserProfiles = CreateDbSetMock(_profiles).Object;
            _dbMock.Object.Protocol = CreateDbSetMock(_protocols).Object;
            _dbMock.Object.Auditor = CreateDbSetMock(_auditors).Object;

            _dbMock.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

            var mappingConfig = new MapperConfiguration(mc => mc.AddProfile(new RatingModelProfile()), NullLoggerFactory.Instance);
            _mapper = mappingConfig.CreateMapper();
            _cacheMock = new Mock<IDistributedCache>();

            _httpContextAccessorMock = new Mock<IHttpContextAccessor>();
            _loginProcessorMock = new Mock<ILoginProcessor>();
            var userContext = new UserContextAccessor(_httpContextAccessorMock.Object, _loginProcessorMock.Object);

            // Content filter: allow everything by default; individual tests can override.
            _contentFilterMock = new Mock<IContentFilterService>();
            _contentFilterMock.Setup(x => x.CheckRateLimitAsync(It.IsAny<int>())).ReturnsAsync(true);
            _contentFilterMock.Setup(x => x.FilterContentAsync(It.IsAny<string>(), It.IsAny<int>()))
                .ReturnsAsync(new ContentFilterResult { IsBlocked = false });

            // Initialize Service
            _service = new RatingService(_dbMock.Object, _cacheMock.Object, userContext, _mapper, _contentFilterMock.Object);
        }

        // --- TESTS ---

        [Fact]
        public async Task AddOrUpdateRating_Should_AddToStore_WhenNew()
        {
            SetupLoggedInUser(10);
            var request = new CreateRatingRequest 
            { 
                EntityType = EntityType.Protocol, 
                EntityId = 1, 
                Score = 5, 
                Review = "Fresh Review" 
            };

            await _service.AddOrUpdateRating(request);

            _dataStore.Should().HaveCount(1);
            _dataStore[0].Review.Should().Be("Fresh Review");
        }

        [Fact]
        public async Task AddOrUpdateRating_Should_UpdateStore_WhenExists()
        {
            SetupLoggedInUser(10);
            _dataStore.Add(new RatingModel { UserId = 10, EntityId = 1, EntityType = EntityType.Protocol, Score = 1, Review = "Old" });

            var request = new CreateRatingRequest 
            { 
                EntityType = EntityType.Protocol, 
                EntityId = 1, 
                Score = 5, 
                Review = "Updated" 
            };

            await _service.AddOrUpdateRating(request);

            _dataStore.Should().HaveCount(1);
            _dataStore[0].Review.Should().Be("Updated");
        }

        [Fact]
        public async Task GetSummary_Should_Calculate_FromStore()
        {
            _dataStore.Add(new RatingModel { UserId = 1, EntityId = 100, EntityType = EntityType.Protocol, Score = 5 });
            _dataStore.Add(new RatingModel { UserId = 2, EntityId = 100, EntityType = EntityType.Protocol, Score = 5 });
            _dataStore.Add(new RatingModel { UserId = 3, EntityId = 100, EntityType = EntityType.Protocol, Score = 1 });

            var summary = await _service.GetSummary(EntityType.Protocol, 100);

            summary.TotalReviews.Should().Be(3);
            summary.AverageScore.Should().Be(3.7f);
        }

        [Fact]
        public async Task DeleteRating_Should_RemoveFromStore_WhenOwner()
        {
            int userId = 50;
            SetupLoggedInUser(userId);
            var rating = new RatingModel { Id = 1, UserId = userId, EntityId = 1, EntityType = EntityType.Protocol };
            _dataStore.Add(rating);

            _ratingSetMock.Setup(x => x.FindAsync(1)).ReturnsAsync(rating);

            await _service.DeleteRating(1);

            _ratingSetMock.Verify(x => x.Remove(rating), Times.Once);
        }

        [Fact]
        public async Task DeleteRating_Should_Throw_If_Hacker()
        {
            SetupLoggedInUser(99, isAdmin: false);
            var rating = new RatingModel { Id = 1, UserId = 50, EntityId = 1, EntityType = EntityType.Protocol };
            _dataStore.Add(rating);
            _ratingSetMock.Setup(x => x.FindAsync(1)).ReturnsAsync(rating);

            await Assert.ThrowsAsync<UnauthorizedAccessException>(() => _service.DeleteRating(1));
        }

        [Fact]
        public async Task DeleteRating_Should_Allow_Admin()
        {
            SetupLoggedInUser(999, isAdmin: true);
            var rating = new RatingModel { Id = 1, UserId = 50, EntityId = 1, EntityType = EntityType.Protocol };
            _dataStore.Add(rating);
            _ratingSetMock.Setup(x => x.FindAsync(1)).ReturnsAsync(rating);

            await _service.DeleteRating(1);
            _ratingSetMock.Verify(x => x.Remove(rating), Times.Once);
        }

        [Fact]
        public async Task GetSummary_Should_ReturnZeroes_WhenNoRatingsExist()
        {
            var summary = await _service.GetSummary(EntityType.Protocol, 999);
            summary.TotalReviews.Should().Be(0);
        }

        [Fact]
        public async Task GetRatings_Should_Paginate_Correctly()
        {
            for (int i = 1; i <= 15; i++)
            {
                _dataStore.Add(new RatingModel
                {
                    Id = i, UserId = i, EntityId = 50, EntityType = EntityType.Protocol, Score = 5,
                    CreatedAt = DateTime.UtcNow.AddMinutes(i)
                });
            }

            var result = await _service.GetRatings(EntityType.Protocol, 50, page: 2, pageSize: 10);
            result.Should().HaveCount(5);
            result.First().Id.Should().Be(5);
        }

        [Theory]
        [InlineData(0)]
        [InlineData(-1)]
        [InlineData(-100)]
        public async Task GetRatings_Should_ClampPageToOne_WhenPageIsZeroOrNegative(int badPage)
        {
            for (int i = 1; i <= 5; i++)
            {
                _dataStore.Add(new RatingModel
                {
                    Id = i, UserId = i, EntityId = 77, EntityType = EntityType.Protocol, Score = 3,
                    CreatedAt = DateTime.UtcNow.AddMinutes(i)
                });
            }

            // Should not throw and should return the same result as page=1
            var result = await _service.GetRatings(EntityType.Protocol, 77, page: badPage, pageSize: 10);
            var resultPage1 = await _service.GetRatings(EntityType.Protocol, 77, page: 1, pageSize: 10);

            result.Should().HaveCount(5);
            result.Should().BeEquivalentTo(resultPage1);
        }

        [Theory]
        [InlineData(0)]
        [InlineData(-5)]
        public async Task GetRatings_Should_ClampPageSize_WhenZeroOrNegative(int badPageSize)
        {
            for (int i = 1; i <= 5; i++)
            {
                _dataStore.Add(new RatingModel
                {
                    Id = i, UserId = i, EntityId = 88, EntityType = EntityType.Protocol, Score = 3,
                    CreatedAt = DateTime.UtcNow.AddMinutes(i)
                });
            }

            // Should not throw; clamped pageSize (>=1) returns at least one item
            var result = await _service.GetRatings(EntityType.Protocol, 88, page: 1, pageSize: badPageSize);

            result.Should().NotBeEmpty();
            result.Should().HaveCount(1);
        }

        [Fact]
        public async Task GetRatings_Should_AttributeAuthor_ByDisplayName()
        {
            _logins.Add(new LoginModel { LoginId = 42, FullName = "Alice", Login = "alice@test.com", Email = "alice@test.com" });
            _dataStore.Add(new RatingModel
            {
                Id = 1, UserId = 42, EntityId = 10, EntityType = EntityType.Protocol, Score = 4,
                Review = "Great", CreatedAt = DateTime.UtcNow
            });

            var result = await _service.GetRatings(EntityType.Protocol, 10, page: 1, pageSize: 10);

            result.Should().HaveCount(1);
            result[0].Should().BeOfType<PublicRatingViewModel>();
            result[0].Score.Should().Be(4);
            result[0].AuthorId.Should().Be(42);
            result[0].AuthorName.Should().Be("Alice");
            // PublicRatingViewModel intentionally has no Email/UserId field — verified by type.
            typeof(PublicRatingViewModel).GetProperty("Email").Should().BeNull();
            typeof(PublicRatingViewModel).GetProperty("UserId").Should().BeNull();
        }

        [Fact]
        public async Task GetRatings_Should_FallBackToLogin_WhenFullNameBlank()
        {
            _logins.Add(new LoginModel { LoginId = 7, FullName = "", Login = "bob" });
            _dataStore.Add(new RatingModel { Id = 1, UserId = 7, EntityId = 11, EntityType = EntityType.Protocol, Score = 3, CreatedAt = DateTime.UtcNow });

            var result = await _service.GetRatings(EntityType.Protocol, 11, page: 1, pageSize: 10);

            result[0].AuthorName.Should().Be("bob");
        }

        [Fact]
        public async Task GetMyRating_Should_ReturnNull_WhenNoRatingExists()
        {
            // /mine is [Authorize]; the meaningful null path is an authenticated user
            // who has not rated this entity yet.
            SetupLoggedInUser(10);

            var result = await _service.GetMyRating(EntityType.Protocol, 1);

            result.Should().BeNull();
        }

        [Fact]
        public async Task GetMyRating_Should_ReturnExisting_ForCaller()
        {
            SetupLoggedInUser(10);
            _dataStore.Add(new RatingModel { Id = 5, UserId = 10, EntityId = 1, EntityType = EntityType.Protocol, Score = 4, Review = "Mine" });

            var result = await _service.GetMyRating(EntityType.Protocol, 1);

            result.Should().NotBeNull();
            result!.Score.Should().Be(4);
            result.Review.Should().Be("Mine");
        }

        [Fact]
        public async Task GetSummary_Should_Weight_ByReputation()
        {
            // user 1 (rep 99) scores 5; user 2 (rep 0) scores 1.
            // plain avg = 3.0; weighted = (5*100 + 1*1)/(100+1) = 501/101 = 4.96 -> 5.0
            _profiles.Add(new UserProfileModel { LoginId = 1, ReputationScore = 99 });
            _dataStore.Add(new RatingModel { UserId = 1, EntityId = 200, EntityType = EntityType.Protocol, Score = 5 });
            _dataStore.Add(new RatingModel { UserId = 2, EntityId = 200, EntityType = EntityType.Protocol, Score = 1 });

            var summary = await _service.GetSummary(EntityType.Protocol, 200);

            summary.AverageScore.Should().Be(3.0f);
            summary.WeightedAverageScore.Should().Be(5.0f);
        }

        [Fact]
        public async Task AddOrUpdateRating_Should_Throw_WhenEntityMissing()
        {
            SetupLoggedInUser(10);
            var request = new CreateRatingRequest { EntityType = EntityType.Protocol, EntityId = 9999, Score = 5, Review = "x" };

            await Assert.ThrowsAsync<KeyNotFoundException>(() => _service.AddOrUpdateRating(request));
            _dataStore.Should().BeEmpty();
        }

        [Fact]
        public async Task AddOrUpdateRating_Should_Throw_WhenReviewBlocked()
        {
            SetupLoggedInUser(10);
            _contentFilterMock.Setup(x => x.FilterContentAsync(It.IsAny<string>(), It.IsAny<int>()))
                .ReturnsAsync(new ContentFilterResult { IsBlocked = true, Warnings = new List<string> { "profanity" } });

            var request = new CreateRatingRequest { EntityType = EntityType.Protocol, EntityId = 1, Score = 5, Review = "rude words" };

            await Assert.ThrowsAsync<InvalidOperationException>(() => _service.AddOrUpdateRating(request));
            _dataStore.Should().BeEmpty();
        }

        [Fact]
        public async Task AddOrUpdateRating_Should_Throw_WhenRateLimited()
        {
            SetupLoggedInUser(10);
            _contentFilterMock.Setup(x => x.CheckRateLimitAsync(It.IsAny<int>())).ReturnsAsync(false);

            var request = new CreateRatingRequest { EntityType = EntityType.Protocol, EntityId = 1, Score = 5, Review = "ok" };

            await Assert.ThrowsAsync<InvalidOperationException>(() => _service.AddOrUpdateRating(request));
            _dataStore.Should().BeEmpty();
        }

        [Fact]
        public async Task AddOrUpdateRating_Should_SkipFilter_WhenReviewEmpty()
        {
            SetupLoggedInUser(10);
            var request = new CreateRatingRequest { EntityType = EntityType.Protocol, EntityId = 1, Score = 4, Review = "" };

            await _service.AddOrUpdateRating(request);

            _dataStore.Should().HaveCount(1);
            _contentFilterMock.Verify(x => x.FilterContentAsync(It.IsAny<string>(), It.IsAny<int>()), Times.Never);
        }

        [Fact]
        public async Task GetRatings_Should_Exclude_HiddenAndDeleted()
        {
            _dataStore.Add(new RatingModel { Id = 1, UserId = 1, EntityId = 70, EntityType = EntityType.Protocol, Score = 5, CreatedAt = DateTime.UtcNow.AddMinutes(3) });
            _dataStore.Add(new RatingModel { Id = 2, UserId = 2, EntityId = 70, EntityType = EntityType.Protocol, Score = 4, IsHidden = true, CreatedAt = DateTime.UtcNow.AddMinutes(2) });
            _dataStore.Add(new RatingModel { Id = 3, UserId = 3, EntityId = 70, EntityType = EntityType.Protocol, Score = 3, IsDeleted = true, CreatedAt = DateTime.UtcNow.AddMinutes(1) });

            var result = await _service.GetRatings(EntityType.Protocol, 70, page: 1, pageSize: 10);

            result.Should().HaveCount(1);
            result[0].Id.Should().Be(1);
        }

        [Fact]
        public async Task GetSummary_Should_Exclude_HiddenAndDeleted()
        {
            _dataStore.Add(new RatingModel { UserId = 1, EntityId = 71, EntityType = EntityType.Protocol, Score = 5 });
            _dataStore.Add(new RatingModel { UserId = 2, EntityId = 71, EntityType = EntityType.Protocol, Score = 1, IsHidden = true });
            _dataStore.Add(new RatingModel { UserId = 3, EntityId = 71, EntityType = EntityType.Protocol, Score = 1, IsDeleted = true });

            var summary = await _service.GetSummary(EntityType.Protocol, 71);

            summary.TotalReviews.Should().Be(1);
            summary.AverageScore.Should().Be(5.0f);
        }

        // --- HELPERS ---

        private void SetupLoggedInUser(int userId, bool isAdmin = false)
        {
            var claims = new List<Claim> { new Claim(ClaimTypes.NameIdentifier, "user@test.com") };
            var identity = new ClaimsIdentity(claims, "Test");
            var principal = new ClaimsPrincipal(identity);
            
            _httpContextAccessorMock.Setup(x => x.HttpContext).Returns(new DefaultHttpContext { User = principal });

            var loginModel = new LoginModel { LoginId = userId, Login = "user@test.com", Role = isAdmin ? RoleEnum.Admin : RoleEnum.User };
            _loginProcessorMock.Setup(x => x.GetByLogin(It.IsAny<string>(), It.IsAny<LoginTypeEnum>())).ReturnsAsync(loginModel);
            _loginProcessorMock.Setup(x => x.GetById(userId)).ReturnsAsync(loginModel);
        }

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
    }

    // --- INFRASTRUCTURE ---

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

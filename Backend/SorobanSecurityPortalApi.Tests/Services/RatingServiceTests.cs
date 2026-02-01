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
        private readonly IMapper _mapper;
        private readonly RatingService _service;
        
        private readonly List<RatingModel> _dataStore;

        public RatingServiceTests()
        {
            _dataStore = new List<RatingModel>();
            _ratingSetMock = CreateDbSetMock(_dataStore);

            // Mock the DbContext
            _dbMock = new Mock<Db>(new DbContextOptions<Db>()) { CallBase = true };
            _dbMock.Setup(x => x.Rating).Returns(_ratingSetMock.Object);
            _dbMock.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

            // Setup AutoMapper
            var mappingConfig = new MapperConfiguration(mc => mc.AddProfile(new RatingModelProfile()));
            _mapper = mappingConfig.CreateMapper();

            // Setup Cache
            _cacheMock = new Mock<IDistributedCache>();

            // Setup UserContext
            _httpContextAccessorMock = new Mock<IHttpContextAccessor>();
            _loginProcessorMock = new Mock<ILoginProcessor>();
            var userContext = new UserContextAccessor(_httpContextAccessorMock.Object, _loginProcessorMock.Object);

            // Initialize Service
            _service = new RatingService(_dbMock.Object, _cacheMock.Object, userContext, _mapper);
        }

        // --- CORE TESTS ---

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

            var result = await _service.AddOrUpdateRating(request);

            result.Score.Should().Be(5);
            _dataStore.Should().HaveCount(1);
            _dataStore[0].Review.Should().Be("Fresh Review");
            _dataStore[0].UserId.Should().Be(10);
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
            _dataStore[0].Score.Should().Be(5);
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
            summary.Distribution[5].Should().Be(2);
            summary.Distribution[1].Should().Be(1);
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
            int ownerId = 50;
            int hackerId = 99;
            SetupLoggedInUser(hackerId, isAdmin: false);
            
            var rating = new RatingModel { Id = 1, UserId = ownerId, EntityId = 1, EntityType = EntityType.Protocol };
            _dataStore.Add(rating);

            _ratingSetMock.Setup(x => x.FindAsync(1)).ReturnsAsync(rating);

            await Assert.ThrowsAsync<UnauthorizedAccessException>(() => _service.DeleteRating(1));
        }

        [Fact]
        public async Task DeleteRating_Should_Allow_Admin()
        {
            int ownerId = 50;
            int adminId = 999;
            SetupLoggedInUser(adminId, isAdmin: true);
            
            var rating = new RatingModel { Id = 1, UserId = ownerId, EntityId = 1, EntityType = EntityType.Protocol };
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
            summary.AverageScore.Should().Be(0);
            summary.Distribution[5].Should().Be(0);
        }

        [Fact]
        public async Task GetRatings_Should_Paginate_Correctly()
        {
            for (int i = 1; i <= 15; i++)
            {
                _dataStore.Add(new RatingModel 
                { 
                    Id = i,
                    UserId = i, 
                    EntityId = 50, 
                    EntityType = EntityType.Protocol, 
                    Score = 5,
                    CreatedAt = DateTime.UtcNow.AddMinutes(i)
                });
            }

            var result = await _service.GetRatings(EntityType.Protocol, 50, page: 2, pageSize: 10);

            result.Should().HaveCount(5); 
            result.First().Id.Should().Be(5);
            result.Last().Id.Should().Be(1);
        }

        // --- HELPERS ---

        private void SetupLoggedInUser(int userId, bool isAdmin = false)
        {
            var claims = new List<Claim> { new Claim(ClaimTypes.NameIdentifier, "user@test.com") };
            var identity = new ClaimsIdentity(claims, "Test");
            var principal = new ClaimsPrincipal(identity);
            
            _httpContextAccessorMock.Setup(x => x.HttpContext).Returns(new DefaultHttpContext { User = principal });

            var loginModel = new LoginModel 
            { 
                LoginId = userId, 
                Login = "user@test.com",
                Role = isAdmin ? RoleEnum.Admin : RoleEnum.User 
            };

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
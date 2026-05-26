# Comments CRUD API — Implementation Plan (PR2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose comments over a REST API — list (with single-level reply nesting + author names), a cached count, create (content-filtered, threading-flattened), and owner/admin soft-delete — all riding the moderation system already wired in PR1.

**Architecture:** `CommentsController → ICommentService → ICommentProcessor → Db`. `CommentService` orchestrates (auth via `IUserContextAccessor`, safety via `IContentFilterService`, count cache via `IDistributedCache`, mapping via AutoMapper) and depends only on mockable interfaces. `CommentProcessor` (from PR1) owns all DB reads/writes incl. cross-table author-name and entity-existence lookups (precedent: `BookmarkProcessor` reads Report/Vulnerability). Mirrors `RatingService`/`RatingController` conventions.

**Tech Stack:** ASP.NET Core, EF Core (PostgreSQL), AutoMapper, xUnit + Moq + FluentAssertions. Branch `feature/comments-discussion`. Baseline: 219 tests green.

**Scope:** GET list, GET count, POST create, DELETE (soft). **Excludes** (later plans): editing + 30-min window + history (#64 → PR2b); voting/`currentUserVote` (#80 → PR3); `@mention` parsing (#75 → PR4); notifications/SignalR; frontend. Moderator hide/delete already works via the existing ModerationController → CommentModerationTarget path.

---

### Task 1: DTOs + AutoMapper profile

**Files:**
- Create: `Backend/SorobanSecurityPortalApi/Models/ViewModels/CommentViewModel.cs`
- Create: `Backend/SorobanSecurityPortalApi/Models/Mapping/CommentModelProfile.cs`

- [ ] **Step 1: Create the DTOs**

`CommentViewModel.cs`:

```csharp
using System;
using System.Collections.Generic;
using SorobanSecurityPortalApi.Models.DbModels;

namespace SorobanSecurityPortalApi.Models.ViewModels
{
    // Public comment DTO. Exposes the author's display name + id (for the public
    // avatar endpoint) — never email or other PII. Replies are nested one level deep.
    public class CommentViewModel
    {
        public int Id { get; set; }
        public EntityType EntityType { get; set; }
        public int EntityId { get; set; }
        public int? ParentCommentId { get; set; }
        public string Content { get; set; } = string.Empty;
        public string ContentHtml { get; set; } = string.Empty;
        public int AuthorId { get; set; }
        public string AuthorName { get; set; } = string.Empty;
        public int UpvoteCount { get; set; }
        public int DownvoteCount { get; set; }
        public bool IsEdited { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public int ReplyCount { get; set; }
        public List<CommentViewModel> Replies { get; set; } = new();
    }

    public class CreateCommentRequest
    {
        public EntityType EntityType { get; set; }
        public int EntityId { get; set; }
        public int? ParentCommentId { get; set; }
        public string Content { get; set; } = string.Empty;
    }
}
```

- [ ] **Step 2: Create the AutoMapper profile**

`CommentModelProfile.cs` (profiles are auto-discovered, like `RatingModelProfile`):

```csharp
using AutoMapper;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;

namespace SorobanSecurityPortalApi.Models.Mapping
{
    public class CommentModelProfile : Profile
    {
        public CommentModelProfile()
        {
            // AuthorName, ReplyCount, and Replies are populated in the service, not mapped.
            CreateMap<CommentModel, CommentViewModel>()
                .ForMember(d => d.AuthorName, o => o.Ignore())
                .ForMember(d => d.ReplyCount, o => o.Ignore())
                .ForMember(d => d.Replies, o => o.Ignore());
        }
    }
}
```

- [ ] **Step 3: Build**

Run: `dotnet build Backend/SorobanSecurityPortalApi/SorobanSecurityPortalApi.csproj -v quiet --nologo`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add Backend/SorobanSecurityPortalApi/Models/ViewModels/CommentViewModel.cs Backend/SorobanSecurityPortalApi/Models/Mapping/CommentModelProfile.cs
git commit -m "feat(comments): add comment DTOs + AutoMapper profile"
```
(Append `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>` to this and every commit below.)

---

### Task 2: CommentProcessor read additions (TDD)

**Files:**
- Modify: `Backend/SorobanSecurityPortalApi/Data/Processors/CommentProcessor.cs`
- Modify: `Backend/SorobanSecurityPortalApi.Tests/Data/CommentProcessorTests.cs`

Add four read methods the service needs. `EntityExists` and `GetAuthorNames` are cross-table reads (precedent: `BookmarkProcessor` reads Report/Vulnerability).

- [ ] **Step 1: Write the failing tests**

Append these tests to `CommentProcessorTests.cs` (inside the class; reuse the existing `BuildFactory` helper, which mocks `db.Comment`). For the cross-table tests, the `BuildFactory` helper must also expose `db.Vulnerability`, `db.Report`, and `db.Login`. Replace the existing `BuildFactory` with this extended version (it keeps the old `out dbMock` signature so existing tests still compile):

```csharp
        private static Mock<DbSet<T>> CreateDbSetMock2<T>(List<T> source) where T : class
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
            dbMock.Setup(d => d.Comment).Returns(CreateDbSetMock2(comments).Object);
            dbMock.Setup(d => d.Vulnerability).Returns(CreateDbSetMock2(vulns ?? new()).Object);
            dbMock.Setup(d => d.Report).Returns(CreateDbSetMock2(reports ?? new()).Object);
            dbMock.Setup(d => d.Login).Returns(CreateDbSetMock2(logins ?? new()).Object);
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
        public async Task EntityExists_True_For_Existing_Report_And_Vulnerability()
        {
            var processor = new CommentProcessor(BuildFullFactory(
                new List<CommentModel>(),
                vulns: new List<VulnerabilityModel> { new() { Id = 7, Title = "v" } },
                reports: new List<ReportModel> { new() { Id = 8, Name = "r" } }).Object);

            (await processor.EntityExists(EntityType.Vulnerability, 7)).Should().BeTrue();
            (await processor.EntityExists(EntityType.Report, 8)).Should().BeTrue();
            (await processor.EntityExists(EntityType.Report, 999)).Should().BeFalse();
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
```

- [ ] **Step 2: Run tests → expect FAIL (methods missing)**

Run: `dotnet test Backend/SorobanSecurityPortalApi.Tests --filter "FullyQualifiedName~CommentProcessorTests"`
Expected: compile failure — `CountByEntity`/`ListReplies`/`EntityExists`/`GetAuthorNames` not defined.

- [ ] **Step 3: Implement the four methods**

In `CommentProcessor.cs`, add these methods to the class and their signatures to `ICommentProcessor`:

```csharp
        public async Task<int> CountByEntity(EntityType entityType, int entityId)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            return await db.Comment.AsNoTracking()
                .CountAsync(c => c.EntityType == entityType && c.EntityId == entityId && !c.IsHidden && !c.IsDeleted);
        }

        public async Task<List<CommentModel>> ListReplies(EntityType entityType, int entityId, List<int> parentIds)
        {
            if (parentIds == null || parentIds.Count == 0) return new List<CommentModel>();
            await using var db = await _dbFactory.CreateDbContextAsync();
            return await db.Comment.AsNoTracking()
                .Where(c => c.EntityType == entityType && c.EntityId == entityId
                            && c.ParentCommentId != null && parentIds.Contains(c.ParentCommentId.Value)
                            && !c.IsHidden && !c.IsDeleted)
                .OrderBy(c => c.CreatedAt)
                .ToListAsync();
        }

        public async Task<bool> EntityExists(EntityType entityType, int entityId)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            return entityType switch
            {
                EntityType.Vulnerability => await db.Vulnerability.AsNoTracking().AnyAsync(v => v.Id == entityId),
                EntityType.Report => await db.Report.AsNoTracking().AnyAsync(r => r.Id == entityId),
                _ => false
            };
        }

        public async Task<Dictionary<int, string>> GetAuthorNames(List<int> userIds)
        {
            if (userIds == null || userIds.Count == 0) return new Dictionary<int, string>();
            await using var db = await _dbFactory.CreateDbContextAsync();
            var rows = await db.Login.AsNoTracking()
                .Where(l => userIds.Contains(l.LoginId))
                .Select(l => new { l.LoginId, l.FullName, l.Login })
                .ToListAsync();
            return rows.ToDictionary(
                r => r.LoginId,
                r => !string.IsNullOrWhiteSpace(r.FullName) ? r.FullName : r.Login);
        }
```

Add to the `ICommentProcessor` interface:

```csharp
        Task<int> CountByEntity(EntityType entityType, int entityId);
        Task<List<CommentModel>> ListReplies(EntityType entityType, int entityId, List<int> parentIds);
        Task<bool> EntityExists(EntityType entityType, int entityId);
        Task<Dictionary<int, string>> GetAuthorNames(List<int> userIds);
```

> Note: if `LoginModel`'s display field is not named `FullName`/`Login`, match the names used in `RatingService.GetRatings` (it selects `l.FullName, l.Login`). They are correct as written.

- [ ] **Step 4: Run tests → expect PASS**

Run: `dotnet test Backend/SorobanSecurityPortalApi.Tests --filter "FullyQualifiedName~CommentProcessorTests"`
Expected: all CommentProcessor tests pass (the 7 prior + 4 new = 11).

- [ ] **Step 5: Commit**

```bash
git add Backend/SorobanSecurityPortalApi/Data/Processors/CommentProcessor.cs Backend/SorobanSecurityPortalApi.Tests/Data/CommentProcessorTests.cs
git commit -m "feat(comments): add CommentProcessor reads (count, replies, entity-exists, author-names)"
```

---

### Task 3: CommentService (TDD)

**Files:**
- Create: `Backend/SorobanSecurityPortalApi/Services/ControllersServices/CommentService.cs`
- Create: `Backend/SorobanSecurityPortalApi.Tests/Services/CommentServiceTests.cs`
- Modify: `Backend/SorobanSecurityPortalApi/Startup.cs` (register `IUserContextAccessor` if not already — see Step 5)

`CommentService` depends only on mockable interfaces, so tests use plain Moq (no `Mock<Db>`). A real `IMapper` built from `CommentModelProfile` is used in tests (not mocked) so mapping is exercised.

- [ ] **Step 1: Write the failing tests**

`CommentServiceTests.cs`:

```csharp
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using AutoMapper;
using FluentAssertions;
using Microsoft.Extensions.Caching.Distributed;
using Moq;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.Mapping;
using SorobanSecurityPortalApi.Models.ViewModels;
using SorobanSecurityPortalApi.Services.ControllersServices;
using Xunit;

namespace SorobanSecurityPortalApi.Tests.Services
{
    public class CommentServiceTests
    {
        private readonly Mock<ICommentProcessor> _processor = new();
        private readonly Mock<IContentFilterService> _filter = new();
        private readonly Mock<IUserContextAccessor> _userContext = new();
        private readonly Mock<IDistributedCache> _cache = new();
        private readonly IMapper _mapper = new MapperConfiguration(c => c.AddProfile<CommentModelProfile>()).CreateMapper();

        private CommentService Build() =>
            new CommentService(_processor.Object, _filter.Object, _userContext.Object, _mapper, _cache.Object);

        private void AllowFilter()
        {
            _filter.Setup(f => f.CheckRateLimitAsync(It.IsAny<int>())).ReturnsAsync(true);
            _filter.Setup(f => f.FilterContentAsync(It.IsAny<string>(), It.IsAny<int>()))
                .ReturnsAsync(new ContentFilterResult { IsBlocked = false, SanitizedContent = "<p>clean</p>" });
        }

        [Fact]
        public async Task GetComments_Nests_Replies_And_Enriches_AuthorNames()
        {
            _processor.Setup(p => p.ListByEntity(EntityType.Report, 9, 1, 20, false))
                .ReturnsAsync(new List<CommentModel> { new() { Id = 1, AuthorId = 5, EntityType = EntityType.Report, EntityId = 9, Content = "top" } });
            _processor.Setup(p => p.ListReplies(EntityType.Report, 9, It.Is<List<int>>(l => l.Contains(1))))
                .ReturnsAsync(new List<CommentModel> { new() { Id = 2, AuthorId = 6, ParentCommentId = 1, EntityType = EntityType.Report, EntityId = 9, Content = "reply" } });
            _processor.Setup(p => p.GetAuthorNames(It.IsAny<List<int>>()))
                .ReturnsAsync(new Dictionary<int, string> { { 5, "Alice" }, { 6, "Bob" } });

            var result = await Build().GetComments(EntityType.Report, 9, 1);

            result.Should().ContainSingle();
            result[0].AuthorName.Should().Be("Alice");
            result[0].ReplyCount.Should().Be(1);
            result[0].Replies.Should().ContainSingle();
            result[0].Replies[0].AuthorName.Should().Be("Bob");
        }

        [Fact]
        public async Task GetComments_Uses_Anonymous_When_AuthorName_Missing()
        {
            _processor.Setup(p => p.ListByEntity(It.IsAny<EntityType>(), It.IsAny<int>(), It.IsAny<int>(), It.IsAny<int>(), false))
                .ReturnsAsync(new List<CommentModel> { new() { Id = 1, AuthorId = 5, Content = "x" } });
            _processor.Setup(p => p.ListReplies(It.IsAny<EntityType>(), It.IsAny<int>(), It.IsAny<List<int>>()))
                .ReturnsAsync(new List<CommentModel>());
            _processor.Setup(p => p.GetAuthorNames(It.IsAny<List<int>>())).ReturnsAsync(new Dictionary<int, string>());

            var result = await Build().GetComments(EntityType.Report, 9, 1);

            result[0].AuthorName.Should().Be("Anonymous");
        }

        [Fact]
        public async Task GetCount_Caches_Result()
        {
            _cache.Setup(c => c.GetAsync(CommentCacheKeysProbe(EntityType.Report, 9), It.IsAny<System.Threading.CancellationToken>()))
                .ReturnsAsync((byte[]?)null);
            _processor.Setup(p => p.CountByEntity(EntityType.Report, 9)).ReturnsAsync(3);

            var count = await Build().GetCount(EntityType.Report, 9);

            count.Should().Be(3);
            _cache.Verify(c => c.SetAsync(It.IsAny<string>(), It.IsAny<byte[]>(), It.IsAny<DistributedCacheEntryOptions>(), It.IsAny<System.Threading.CancellationToken>()), Times.Once);
        }

        // Helper so the test references the same key the service uses.
        private static string CommentCacheKeysProbe(EntityType t, int id) =>
            SorobanSecurityPortalApi.Services.Moderation.CommentCacheKeys.Count(t, id);

        [Fact]
        public async Task AddComment_Rejects_When_Not_Authenticated()
        {
            _userContext.Setup(u => u.GetLoginIdAsync()).ReturnsAsync(0);
            await Build().Invoking(s => s.AddComment(new CreateCommentRequest { EntityType = EntityType.Report, EntityId = 9, Content = "hi" }))
                .Should().ThrowAsync<UnauthorizedAccessException>();
        }

        [Fact]
        public async Task AddComment_Rejects_When_Entity_Missing()
        {
            _userContext.Setup(u => u.GetLoginIdAsync()).ReturnsAsync(5);
            _processor.Setup(p => p.EntityExists(EntityType.Report, 9)).ReturnsAsync(false);
            await Build().Invoking(s => s.AddComment(new CreateCommentRequest { EntityType = EntityType.Report, EntityId = 9, Content = "hi" }))
                .Should().ThrowAsync<KeyNotFoundException>();
        }

        [Fact]
        public async Task AddComment_Rejects_When_Content_Blocked()
        {
            _userContext.Setup(u => u.GetLoginIdAsync()).ReturnsAsync(5);
            _processor.Setup(p => p.EntityExists(EntityType.Report, 9)).ReturnsAsync(true);
            _filter.Setup(f => f.CheckRateLimitAsync(5)).ReturnsAsync(true);
            _filter.Setup(f => f.FilterContentAsync("spam", 5))
                .ReturnsAsync(new ContentFilterResult { IsBlocked = true, Warnings = new List<string> { "spam" } });

            await Build().Invoking(s => s.AddComment(new CreateCommentRequest { EntityType = EntityType.Report, EntityId = 9, Content = "spam" }))
                .Should().ThrowAsync<InvalidOperationException>();
        }

        [Fact]
        public async Task AddComment_Stores_SanitizedHtml_And_Invalidates_Count()
        {
            _userContext.Setup(u => u.GetLoginIdAsync()).ReturnsAsync(5);
            _processor.Setup(p => p.EntityExists(EntityType.Report, 9)).ReturnsAsync(true);
            AllowFilter();
            _processor.Setup(p => p.GetAuthorNames(It.IsAny<List<int>>())).ReturnsAsync(new Dictionary<int, string> { { 5, "Alice" } });
            CommentModel? saved = null;
            _processor.Setup(p => p.Add(It.IsAny<CommentModel>()))
                .ReturnsAsync((CommentModel c) => { c.Id = 100; saved = c; return c; });

            var vm = await Build().AddComment(new CreateCommentRequest { EntityType = EntityType.Report, EntityId = 9, Content = "hello" });

            saved!.AuthorId.Should().Be(5);
            saved.ContentHtml.Should().Be("<p>clean</p>");
            saved.ParentCommentId.Should().BeNull();
            vm.AuthorName.Should().Be("Alice");
            _cache.Verify(c => c.RemoveAsync(CommentCacheKeysProbe(EntityType.Report, 9), It.IsAny<System.Threading.CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task AddComment_Flattens_Reply_To_Top_Level_Parent()
        {
            _userContext.Setup(u => u.GetLoginIdAsync()).ReturnsAsync(5);
            _processor.Setup(p => p.EntityExists(EntityType.Report, 9)).ReturnsAsync(true);
            AllowFilter();
            _processor.Setup(p => p.GetAuthorNames(It.IsAny<List<int>>())).ReturnsAsync(new Dictionary<int, string>());
            // The user replies to comment 50, which is itself a reply to top-level 1.
            _processor.Setup(p => p.Get(50)).ReturnsAsync(new CommentModel { Id = 50, ParentCommentId = 1, EntityType = EntityType.Report, EntityId = 9 });
            CommentModel? saved = null;
            _processor.Setup(p => p.Add(It.IsAny<CommentModel>())).ReturnsAsync((CommentModel c) => { saved = c; return c; });

            await Build().AddComment(new CreateCommentRequest { EntityType = EntityType.Report, EntityId = 9, ParentCommentId = 50, Content = "nested" });

            saved!.ParentCommentId.Should().Be(1); // flattened to the top-level ancestor
        }

        [Fact]
        public async Task DeleteComment_Allows_Owner_And_Invalidates_Count()
        {
            _userContext.Setup(u => u.GetLoginIdAsync()).ReturnsAsync(5);
            _processor.Setup(p => p.Get(100)).ReturnsAsync(new CommentModel { Id = 100, AuthorId = 5, EntityType = EntityType.Report, EntityId = 9 });

            await Build().DeleteComment(100);

            _processor.Verify(p => p.SoftDelete(100), Times.Once);
            _cache.Verify(c => c.RemoveAsync(CommentCacheKeysProbe(EntityType.Report, 9), It.IsAny<System.Threading.CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task DeleteComment_Rejects_NonOwner_NonAdmin()
        {
            _userContext.Setup(u => u.GetLoginIdAsync()).ReturnsAsync(7);
            _userContext.Setup(u => u.IsLoginIdAdmin(7)).ReturnsAsync(false);
            _processor.Setup(p => p.Get(100)).ReturnsAsync(new CommentModel { Id = 100, AuthorId = 5 });

            await Build().Invoking(s => s.DeleteComment(100)).Should().ThrowAsync<UnauthorizedAccessException>();
            _processor.Verify(p => p.SoftDelete(It.IsAny<int>()), Times.Never);
        }
    }
}
```

- [ ] **Step 2: Run tests → expect FAIL (CommentService missing)**

Run: `dotnet test Backend/SorobanSecurityPortalApi.Tests --filter "FullyQualifiedName~CommentServiceTests"`
Expected: compile failure.

- [ ] **Step 3: Implement `CommentService`**

`CommentService.cs`:

```csharp
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using AutoMapper;
using Microsoft.Extensions.Caching.Distributed;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;
using SorobanSecurityPortalApi.Services.Moderation;

namespace SorobanSecurityPortalApi.Services.ControllersServices
{
    public interface ICommentService
    {
        Task<List<CommentViewModel>> GetComments(EntityType entityType, int entityId, int page, int pageSize = 20);
        Task<int> GetCount(EntityType entityType, int entityId);
        Task<CommentViewModel> AddComment(CreateCommentRequest request);
        Task DeleteComment(int id);
    }

    public class CommentService : ICommentService
    {
        private readonly ICommentProcessor _processor;
        private readonly IContentFilterService _contentFilter;
        private readonly IUserContextAccessor _userContext;
        private readonly IMapper _mapper;
        private readonly IDistributedCache _cache;

        public CommentService(
            ICommentProcessor processor, IContentFilterService contentFilter,
            IUserContextAccessor userContext, IMapper mapper, IDistributedCache cache)
        {
            _processor = processor;
            _contentFilter = contentFilter;
            _userContext = userContext;
            _mapper = mapper;
            _cache = cache;
        }

        public async Task<List<CommentViewModel>> GetComments(EntityType entityType, int entityId, int page, int pageSize = 20)
        {
            page = Math.Max(1, page);
            pageSize = Math.Max(1, Math.Min(100, pageSize));

            var top = await _processor.ListByEntity(entityType, entityId, page, pageSize, includeSuppressed: false);
            var topIds = top.Select(c => c.Id).ToList();
            var replies = await _processor.ListReplies(entityType, entityId, topIds);

            var names = await _processor.GetAuthorNames(
                top.Select(c => c.AuthorId).Concat(replies.Select(r => r.AuthorId)).Distinct().ToList());

            CommentViewModel ToVm(CommentModel c)
            {
                var vm = _mapper.Map<CommentViewModel>(c);
                vm.AuthorName = names.TryGetValue(c.AuthorId, out var n) && !string.IsNullOrWhiteSpace(n) ? n : "Anonymous";
                return vm;
            }

            var repliesByParent = replies.GroupBy(r => r.ParentCommentId!.Value)
                .ToDictionary(g => g.Key, g => g.Select(ToVm).ToList());

            var result = new List<CommentViewModel>(top.Count);
            foreach (var c in top)
            {
                var vm = ToVm(c);
                if (repliesByParent.TryGetValue(c.Id, out var rs))
                {
                    vm.Replies = rs;
                    vm.ReplyCount = rs.Count;
                }
                result.Add(vm);
            }
            return result;
        }

        public async Task<int> GetCount(EntityType entityType, int entityId)
        {
            var key = CommentCacheKeys.Count(entityType, entityId);
            var cached = await _cache.GetStringAsync(key);
            if (!string.IsNullOrEmpty(cached) && int.TryParse(cached, out var n)) return n;

            var count = await _processor.CountByEntity(entityType, entityId);
            await _cache.SetStringAsync(key, count.ToString(),
                new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(10) });
            return count;
        }

        public async Task<CommentViewModel> AddComment(CreateCommentRequest request)
        {
            var userId = await _userContext.GetLoginIdAsync();
            if (userId == 0) throw new UnauthorizedAccessException("User not logged in.");

            if (!await _processor.EntityExists(request.EntityType, request.EntityId))
                throw new KeyNotFoundException($"{request.EntityType} with id {request.EntityId} not found.");

            if (!await _contentFilter.CheckRateLimitAsync(userId))
                throw new InvalidOperationException("Rate limit exceeded. Please wait a moment before submitting again.");

            var filterResult = await _contentFilter.FilterContentAsync(request.Content, userId);
            if (filterResult.IsBlocked)
                throw new InvalidOperationException($"Comment blocked: {string.Join("; ", filterResult.Warnings)}");

            // Single-level threading: a reply always attaches to a TOP-LEVEL comment.
            // Replying to a reply re-parents to that reply's own top-level ancestor.
            int? parentId = null;
            if (request.ParentCommentId.HasValue)
            {
                var parent = await _processor.Get(request.ParentCommentId.Value);
                if (parent == null || parent.IsDeleted
                    || parent.EntityType != request.EntityType || parent.EntityId != request.EntityId)
                    throw new KeyNotFoundException($"Parent comment {request.ParentCommentId} not found on this entity.");
                parentId = parent.ParentCommentId ?? parent.Id;
            }

            var comment = new CommentModel
            {
                AuthorId = userId,
                EntityType = request.EntityType,
                EntityId = request.EntityId,
                ParentCommentId = parentId,
                Content = request.Content,
                ContentHtml = filterResult.SanitizedContent ?? string.Empty,
                CreatedAt = DateTime.UtcNow
            };
            var saved = await _processor.Add(comment);
            await InvalidateCount(request.EntityType, request.EntityId);

            var names = await _processor.GetAuthorNames(new List<int> { userId });
            var vm = _mapper.Map<CommentViewModel>(saved);
            vm.AuthorName = names.TryGetValue(userId, out var nm) && !string.IsNullOrWhiteSpace(nm) ? nm : "Anonymous";
            return vm;
        }

        public async Task DeleteComment(int id)
        {
            var userId = await _userContext.GetLoginIdAsync();
            var comment = await _processor.Get(id);
            if (comment == null) throw new KeyNotFoundException($"Comment with id {id} not found.");

            if (comment.AuthorId != userId && !await _userContext.IsLoginIdAdmin(userId))
                throw new UnauthorizedAccessException("You can only delete your own comments.");

            await _processor.SoftDelete(id);
            await InvalidateCount(comment.EntityType, comment.EntityId);
        }

        private Task InvalidateCount(EntityType type, int id) => _cache.RemoveAsync(CommentCacheKeys.Count(type, id));
    }
}
```

- [ ] **Step 4: Run tests → expect PASS**

Run: `dotnet test Backend/SorobanSecurityPortalApi.Tests --filter "FullyQualifiedName~CommentServiceTests"`
Expected: 9 tests pass. (If `GetCount_Caches_Result` fails on the cache mock, note that `GetStringAsync`/`SetStringAsync` are extension methods over `IDistributedCache.GetAsync`/`SetAsync`; the test mocks the underlying `GetAsync`/`SetAsync` — keep them as written.)

- [ ] **Step 5: Ensure `IUserContextAccessor` is registered in DI**

Open `Startup.cs` and search for `IUserContextAccessor`. The existing registration is `services.AddScoped<UserContextAccessor>();` (concrete). Add the interface mapping right after it so `CommentService` can depend on the interface:

```csharp
        services.AddScoped<IUserContextAccessor>(sp => sp.GetRequiredService<UserContextAccessor>());
```

(If `IUserContextAccessor` is already registered, skip this.) `ICommentService` itself auto-registers via the existing `^I(?!.*Processor$).*` transient convention — verify `IRatingService` is NOT explicitly registered in `Startup.cs`; if it IS explicitly registered, mirror that and add `services.AddScoped<ICommentService, CommentService>();`.

- [ ] **Step 6: Build + commit**

Run: `dotnet build Backend/SorobanSecurityPortalApi/SorobanSecurityPortalApi.csproj -v quiet --nologo` → 0 errors.

```bash
git add Backend/SorobanSecurityPortalApi/Services/ControllersServices/CommentService.cs Backend/SorobanSecurityPortalApi.Tests/Services/CommentServiceTests.cs Backend/SorobanSecurityPortalApi/Startup.cs
git commit -m "feat(comments): add CommentService (list/count/create/delete) with tests"
```

---

### Task 4: CommentsController + full suite

**Files:**
- Create: `Backend/SorobanSecurityPortalApi/Controllers/CommentsController.cs`

Mirrors `RatingController` exactly (route, `[Authorize]` placement, try/catch → status mapping).

- [ ] **Step 1: Implement the controller**

`CommentsController.cs`:

```csharp
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;
using SorobanSecurityPortalApi.Services.ControllersServices;

namespace SorobanSecurityPortalApi.Controllers
{
    [ApiController]
    [Route("api/v1/comments")]
    public class CommentsController : ControllerBase
    {
        private readonly ICommentService _commentService;

        public CommentsController(ICommentService commentService)
        {
            _commentService = commentService;
        }

        [HttpGet]
        public async Task<IActionResult> Get([FromQuery] EntityType entityType, [FromQuery] int entityId, [FromQuery] int page = 1)
        {
            if (entityId <= 0) return BadRequest("EntityId must be a positive integer.");
            var result = await _commentService.GetComments(entityType, entityId, page);
            return Ok(result);
        }

        [HttpGet("count")]
        public async Task<IActionResult> Count([FromQuery] EntityType entityType, [FromQuery] int entityId)
        {
            if (entityId <= 0) return BadRequest("EntityId must be a positive integer.");
            var count = await _commentService.GetCount(entityType, entityId);
            return Ok(count);
        }

        [HttpPost]
        [Authorize]
        public async Task<IActionResult> Create([FromBody] CreateCommentRequest request)
        {
            if (request == null) return BadRequest("Request body cannot be null.");
            if (request.EntityId <= 0) return BadRequest("EntityId must be a positive integer.");
            if (string.IsNullOrWhiteSpace(request.Content)) return BadRequest("Content must not be empty.");
            if (request.Content.Length > 10000) return BadRequest("Content must not exceed 10000 characters.");

            try
            {
                var result = await _commentService.AddComment(request);
                return Ok(result);
            }
            catch (KeyNotFoundException ex) { return NotFound(ex.Message); }
            catch (InvalidOperationException ex) { return BadRequest(ex.Message); }
        }

        [HttpDelete("{id}")]
        [Authorize]
        public async Task<IActionResult> Delete(int id)
        {
            if (id <= 0) return BadRequest("Comment ID must be a positive integer.");
            try
            {
                await _commentService.DeleteComment(id);
                return NoContent();
            }
            catch (System.UnauthorizedAccessException) { return Forbid(); }
            catch (KeyNotFoundException) { return NotFound($"Comment with id {id} not found."); }
        }
    }
}
```

- [ ] **Step 2: Build**

Run: `dotnet build Backend/SorobanSecurityPortalApi/SorobanSecurityPortalApi.csproj -v quiet --nologo`
Expected: 0 errors.

- [ ] **Step 3: Run the FULL suite (no regressions)**

Run: `dotnet test Backend/SorobanSecurityPortalApi.Tests`
Expected: 0 failures. Total = 219 (prior) + 4 (CommentProcessor) + 9 (CommentService) = **232**.

- [ ] **Step 4: Commit**

```bash
git add Backend/SorobanSecurityPortalApi/Controllers/CommentsController.cs
git commit -m "feat(comments): add CommentsController (list/count/create/delete)"
```

---

## Self-Review

**Spec coverage (PR2 slice of spec §6):** GET list with single-level reply nesting + author names (Task 3 `GetComments`); GET count cached (Task 3 `GetCount` + Task 2 `CountByEntity`); POST create with content filter + `content_html` population + 10000 guard + threading flatten (Task 3 `AddComment` + Task 4 validation); DELETE soft (owner/admin) (Task 3 `DeleteComment`). Moderator hide/delete already works via existing ModerationController → CommentModerationTarget (PR1 + the ModerationParsing fix). ✓

**Deferred (not gaps):** edit + 30-min window + history (#64 → PR2b); `currentUserVote` + vote counts populate via PR3; `@mention` parsing (PR4); notifications/SignalR; frontend.

**Placeholder scan:** none — every step has concrete code or an exact command + expected output.

**Type consistency:** `ICommentProcessor` gains `CountByEntity`/`ListReplies`/`EntityExists`/`GetAuthorNames` (Task 2) used by `CommentService` (Task 3); `CommentService` ctor `(ICommentProcessor, IContentFilterService, IUserContextAccessor, IMapper, IDistributedCache)` matches the test `Build()`; `CommentCacheKeys.Count` reused from PR1; `ContentFilterResult` fields `IsBlocked`/`SanitizedContent`/`Warnings` match `IContentFilterService`. Controller routes/DTOs match `CreateCommentRequest`/`CommentViewModel`. Consistent.

## Next plans
PR2b: comment editing + 30-min window + edit history (#64). PR3: voting. PR4: mentions. PR5: SignalR + notifications. PR6-8: frontend.

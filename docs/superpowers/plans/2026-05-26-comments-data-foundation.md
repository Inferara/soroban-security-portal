# Comments Data Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the comment persistence layer and wire comments into the existing moderation system, so a comment can be stored, read, soft-deleted, and hidden/restored/deleted by a moderator — fully unit-tested.

**Architecture:** Mirror the rating stack exactly. A new `comment` table (polymorphic via `EntityType`+`EntityId`, single-level threading via `ParentCommentId`, soft-delete + moderation flags `IsHidden`/`IsDeleted`) with a `CommentProcessor` (data access, like `BookmarkProcessor`) and a `CommentModerationTarget` (mirrors `RatingModerationTarget`) registered in `ModerationTargetRegistry`. No controller/service/API yet — that's the next plan.

**Tech Stack:** ASP.NET Core, EF Core + Npgsql (PostgreSQL, snake_case via `Db.OnModelCreating`), xUnit + Moq + FluentAssertions. Base branch: `feature/comments-discussion` (cut from `origin/main`).

**Scope of this plan = spec §5 (comment table), part of §8 (moderation target). Excludes:** API endpoints, content filter on write, voting, mentions, notifications, SignalR, frontend — each a later plan.

---

### Task 1: Extend the shared enums

**Files:**
- Modify: `Backend/SorobanSecurityPortalApi/Models/DbModels/RatingModel.cs:7-11`
- Modify: `Backend/SorobanSecurityPortalApi/Models/DbModels/ModerationEnums.cs:3`

- [ ] **Step 1: Add `Vulnerability` and `Report` to `EntityType`**

In `RatingModel.cs`, replace the enum:

```csharp
    public enum EntityType
    {
        Protocol = 0,
        Auditor = 1,
        Vulnerability = 2,
        Report = 3
    }
```

(Additive only — existing `Protocol`/`Auditor` values are unchanged, so ratings are unaffected. Comments attach to `Vulnerability`/`Report`.)

- [ ] **Step 2: Add `Comment` to `ModeratedContentType`**

In `ModerationEnums.cs`, replace the enum line:

```csharp
    public enum ModeratedContentType { Vulnerability = 1, Report = 2, Rating = 3, Comment = 4 }
```

- [ ] **Step 3: Build to confirm no breakage**

Run: `dotnet build Backend/SorobanSecurityPortalApi/SorobanSecurityPortalApi.csproj`
Expected: Build succeeded, 0 errors.

- [ ] **Step 4: Commit**

```bash
git add Backend/SorobanSecurityPortalApi/Models/DbModels/RatingModel.cs Backend/SorobanSecurityPortalApi/Models/DbModels/ModerationEnums.cs
git commit -m "feat(comments): extend EntityType + ModeratedContentType enums"
```

---

### Task 2: Add the `CommentModel` entity

**Files:**
- Create: `Backend/SorobanSecurityPortalApi/Models/DbModels/CommentModel.cs`

- [ ] **Step 1: Create the model**

```csharp
using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SorobanSecurityPortalApi.Models.DbModels
{
    [Table("comment")]
    public class CommentModel
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int AuthorId { get; set; }

        [Required]
        public EntityType EntityType { get; set; }

        [Required]
        public int EntityId { get; set; }

        // Null = top-level. Replies always point at a TOP-LEVEL comment (single-level threading).
        public int? ParentCommentId { get; set; }

        [Required]
        public string Content { get; set; } = string.Empty;

        // Sanitized HTML produced by the content filter (populated when the API is added).
        public string ContentHtml { get; set; } = string.Empty;

        // Moderation suppression flags (mirror RatingModel). Hidden or soft-deleted
        // comments are excluded from all public reads.
        public bool IsHidden { get; set; }
        public bool IsDeleted { get; set; }

        public int UpvoteCount { get; set; }
        public int DownvoteCount { get; set; }

        public bool IsEdited { get; set; }

        // JSON array of { editedAt, previousContent }; default empty array.
        [Column(TypeName = "jsonb")]
        public string EditHistory { get; set; } = "[]";

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
        public DateTime? DeletedAt { get; set; }
    }
}
```

- [ ] **Step 2: Build**

Run: `dotnet build Backend/SorobanSecurityPortalApi/SorobanSecurityPortalApi.csproj`
Expected: Build succeeded.

- [ ] **Step 3: Commit**

```bash
git add Backend/SorobanSecurityPortalApi/Models/DbModels/CommentModel.cs
git commit -m "feat(comments): add CommentModel entity"
```

---

### Task 3: Register the DbSet and indexes

**Files:**
- Modify: `Backend/SorobanSecurityPortalApi/Common/Data/Db.cs` (DbSet block near line 30; index config in `OnModelCreating` near line 160-174)

- [ ] **Step 1: Add the DbSet**

After the line `public DbSet<ModerationActionModel> ModerationAction { get; set; }` (Db.cs:32), add:

```csharp
        public virtual DbSet<CommentModel> Comment { get; set; }
```

(`virtual` so it can be mocked in tests, matching `Rating`/`Vulnerability`/`Report`.)

- [ ] **Step 2: Add indexes**

In `OnModelCreating`, immediately after the existing `ModerationAction` index block (the `.HasIndex(a => a.CreatedAt);` around Db.cs:174), add:

```csharp
            modelBuilder.Entity<CommentModel>()
                .HasIndex(c => new { c.EntityType, c.EntityId });
            modelBuilder.Entity<CommentModel>()
                .HasIndex(c => c.AuthorId);
            modelBuilder.Entity<CommentModel>()
                .HasIndex(c => c.ParentCommentId);
```

- [ ] **Step 3: Build**

Run: `dotnet build Backend/SorobanSecurityPortalApi/SorobanSecurityPortalApi.csproj`
Expected: Build succeeded.

- [ ] **Step 4: Commit**

```bash
git add Backend/SorobanSecurityPortalApi/Common/Data/Db.cs
git commit -m "feat(comments): register Comment DbSet + indexes"
```

---

### Task 4: Generate the EF migration (with snapshot)

**Files:**
- Create: `Backend/SorobanSecurityPortalApi/Migrations/<timestamp>_AddComments.cs` (+ `.Designer.cs`)
- Modify: `Backend/SorobanSecurityPortalApi/Migrations/DbModelSnapshot.cs`

> **CRITICAL (known repo gotcha):** the migration MUST be generated with the EF CLI, never hand-written. Hand-written migrations in this repo have shipped without the `.Designer.cs`/snapshot update and silently failed to apply. The CLI generates all three artifacts.

- [ ] **Step 1: Ensure the EF tool is available**

Run: `dotnet tool restore` (in repo root). If that reports no manifest/tool, run: `dotnet tool install --global dotnet-ef`
Expected: `dotnet ef` is runnable.

- [ ] **Step 2: Generate the migration**

Run (from the API project directory):
```bash
cd Backend/SorobanSecurityPortalApi
dotnet ef migrations add AddComments --context Db
cd ../..
```
Expected: creates `Migrations/<timestamp>_AddComments.cs` + `.Designer.cs` and updates `Migrations/DbModelSnapshot.cs`.

- [ ] **Step 3: Verify the generated migration creates the `comment` table**

Open the new `<timestamp>_AddComments.cs`. Confirm `Up()` calls `migrationBuilder.CreateTable(name: "comment", ...)` with snake_case columns (`author_id`, `entity_type`, `entity_id`, `parent_comment_id`, `content`, `content_html`, `is_hidden`, `is_deleted`, `upvote_count`, `downvote_count`, `is_edited`, `edit_history` as `jsonb`, `created_at`, `updated_at`, `deleted_at`) and the three `ix_comment_*` indexes. Confirm `git status` shows `DbModelSnapshot.cs` modified.
Expected: all present; if `DbModelSnapshot.cs` is NOT modified, STOP — the migration is broken; delete it and re-run Step 2.

- [ ] **Step 4: Build**

Run: `dotnet build Backend/SorobanSecurityPortalApi/SorobanSecurityPortalApi.csproj`
Expected: Build succeeded.

- [ ] **Step 5: Commit**

```bash
git add Backend/SorobanSecurityPortalApi/Migrations/
git commit -m "feat(comments): add AddComments EF migration + snapshot"
```

---

### Task 5: `CommentProcessor` data-access layer (TDD)

**Files:**
- Create: `Backend/SorobanSecurityPortalApi/Data/Processors/CommentProcessor.cs`
- Create: `Backend/SorobanSecurityPortalApi.Tests/Data/CommentProcessorTests.cs`

> `CommentProcessor` mirrors `BookmarkProcessor` (constructor takes `IDbContextFactory<Db>`; each method opens a context with `CreateDbContextAsync`). It auto-registers in DI via the `^I.*Processor$` convention in `Startup.cs` — no manual registration needed.

- [ ] **Step 1: Write the failing tests**

Create `CommentProcessorTests.cs`. The test project already contains `TestAsyncQueryProvider<T>` / `TestAsyncEnumerator<T>` (used by `ModerationTargetTests`); reuse them via the local `CreateDbSetMock`/factory helpers below.

```csharp
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `dotnet test Backend/SorobanSecurityPortalApi.Tests --filter "FullyQualifiedName~CommentProcessorTests"`
Expected: FAIL to compile — `CommentProcessor` does not exist.

- [ ] **Step 3: Implement `CommentProcessor`**

```csharp
using Microsoft.EntityFrameworkCore;
using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Models.DbModels;

namespace SorobanSecurityPortalApi.Data.Processors
{
    public class CommentProcessor : ICommentProcessor
    {
        private readonly IDbContextFactory<Db> _dbFactory;

        public CommentProcessor(IDbContextFactory<Db> dbFactory)
        {
            _dbFactory = dbFactory;
        }

        public async Task<CommentModel> Add(CommentModel comment)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            db.Comment.Add(comment);
            await db.SaveChangesAsync();
            return comment;
        }

        public async Task<CommentModel?> Get(int id)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            return await db.Comment.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
        }

        public async Task<List<CommentModel>> ListByEntity(
            EntityType entityType, int entityId, int page, int pageSize, bool includeSuppressed)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var query = db.Comment.AsNoTracking()
                .Where(c => c.EntityType == entityType && c.EntityId == entityId)
                .Where(c => c.ParentCommentId == null);
            if (!includeSuppressed)
            {
                query = query.Where(c => !c.IsHidden && !c.IsDeleted);
            }
            return await query
                .OrderBy(c => c.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();
        }

        public async Task SoftDelete(int id)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var comment = await db.Comment.FirstOrDefaultAsync(x => x.Id == id);
            if (comment == null) return;
            comment.IsDeleted = true;
            comment.DeletedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
        }
    }

    public interface ICommentProcessor
    {
        Task<CommentModel> Add(CommentModel comment);
        Task<CommentModel?> Get(int id);
        Task<List<CommentModel>> ListByEntity(EntityType entityType, int entityId, int page, int pageSize, bool includeSuppressed);
        Task SoftDelete(int id);
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `dotnet test Backend/SorobanSecurityPortalApi.Tests --filter "FullyQualifiedName~CommentProcessorTests"`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add Backend/SorobanSecurityPortalApi/Data/Processors/CommentProcessor.cs Backend/SorobanSecurityPortalApi.Tests/Data/CommentProcessorTests.cs
git commit -m "feat(comments): add CommentProcessor data layer with tests"
```

---

### Task 6: `CommentModerationTarget` + cache-key helper (TDD)

**Files:**
- Create: `Backend/SorobanSecurityPortalApi/Services/Moderation/CommentCacheKeys.cs`
- Create: `Backend/SorobanSecurityPortalApi/Services/Moderation/CommentModerationTarget.cs`
- Create: `Backend/SorobanSecurityPortalApi.Tests/Services/CommentModerationTargetTests.cs`

> Mirrors `RatingModerationTarget` exactly: `Get` returns a `ModerationTargetInfo`, `Hide`/`Restore`/`SoftDelete` flip `IsHidden`/`IsDeleted` and invalidate the per-entity comment-count cache. The cache key lives in a small static helper now so the future `CommentService` reuses it (like `RatingService.SummaryCacheKey`).

- [ ] **Step 1: Write the failing tests**

```csharp
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `dotnet test Backend/SorobanSecurityPortalApi.Tests --filter "FullyQualifiedName~CommentModerationTargetTests"`
Expected: FAIL to compile — `CommentModerationTarget` / `CommentCacheKeys` do not exist.

- [ ] **Step 3: Implement the cache-key helper**

`CommentCacheKeys.cs`:

```csharp
using SorobanSecurityPortalApi.Models.DbModels;

namespace SorobanSecurityPortalApi.Services.Moderation
{
    public static class CommentCacheKeys
    {
        public static string Count(EntityType entityType, int entityId)
            => $"comments_count_{entityType}_{entityId}";
    }
}
```

- [ ] **Step 4: Implement `CommentModerationTarget`**

`CommentModerationTarget.cs`:

```csharp
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;
using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Models.DbModels;

namespace SorobanSecurityPortalApi.Services.Moderation
{
    public class CommentModerationTarget : IModerationTarget
    {
        private readonly IDbContextFactory<Db> _dbFactory;
        private readonly IDistributedCache _cache;

        public CommentModerationTarget(IDbContextFactory<Db> dbFactory, IDistributedCache cache)
        {
            _dbFactory = dbFactory;
            _cache = cache;
        }

        public ModeratedContentType ContentType => ModeratedContentType.Comment;

        public async Task<ModerationTargetInfo?> Get(int contentId)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var c = await db.Comment.AsNoTracking().FirstOrDefaultAsync(x => x.Id == contentId);
            if (c == null) return null;

            return new ModerationTargetInfo
            {
                Preview = c.Content.Length > 200 ? c.Content[..200] : c.Content,
                FullContent = c.Content,
                AuthorUserId = c.AuthorId,
                IsHidden = c.IsHidden,
                IsDeleted = c.IsDeleted
            };
        }

        public Task Hide(int contentId) => SetFlags(contentId, true, null);
        public Task Restore(int contentId) => SetFlags(contentId, false, false);
        public Task SoftDelete(int contentId) => SetFlags(contentId, null, true);

        private async Task SetFlags(int contentId, bool? isHidden, bool? isDeleted)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var c = await db.Comment.FirstOrDefaultAsync(x => x.Id == contentId);
            if (c == null) return;
            if (isHidden.HasValue) c.IsHidden = isHidden.Value;
            if (isDeleted.HasValue) c.IsDeleted = isDeleted.Value;
            await db.SaveChangesAsync();

            // Visibility changed → the cached comment count for this entity is now stale.
            await _cache.RemoveAsync(CommentCacheKeys.Count(c.EntityType, c.EntityId));
        }
    }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `dotnet test Backend/SorobanSecurityPortalApi.Tests --filter "FullyQualifiedName~CommentModerationTargetTests"`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add Backend/SorobanSecurityPortalApi/Services/Moderation/CommentCacheKeys.cs Backend/SorobanSecurityPortalApi/Services/Moderation/CommentModerationTarget.cs Backend/SorobanSecurityPortalApi.Tests/Services/CommentModerationTargetTests.cs
git commit -m "feat(comments): add CommentModerationTarget + cache keys with tests"
```

---

### Task 7: Register the moderation target in DI + full suite green

**Files:**
- Modify: `Backend/SorobanSecurityPortalApi/Startup.cs:62-63`

- [ ] **Step 1: Register `CommentModerationTarget`**

In `Startup.cs`, after the line `services.AddScoped<IModerationTarget, RatingModerationTarget>();` (line 62) and before the `ModerationTargetRegistry` registration (line 63), add:

```csharp
        services.AddScoped<IModerationTarget, CommentModerationTarget>();
```

(The registry collects all `IModerationTarget` via `IEnumerable<IModerationTarget>`, so this is all that's needed for comments to appear in the moderation system. `ICommentProcessor` is auto-registered by the `^I.*Processor$` convention.)

- [ ] **Step 2: Build**

Run: `dotnet build Backend/SorobanSecurityPortalApi/SorobanSecurityPortalApi.csproj`
Expected: Build succeeded.

- [ ] **Step 3: Run the FULL backend test suite (no regressions)**

Run: `dotnet test Backend/SorobanSecurityPortalApi.Tests`
Expected: PASS — all pre-existing tests plus the 11 new comment tests green.

- [ ] **Step 4: Commit**

```bash
git add Backend/SorobanSecurityPortalApi/Startup.cs
git commit -m "feat(comments): register CommentModerationTarget in DI"
```

---

## Self-Review

**Spec coverage (this plan's slice):**
- §5 `comment` table — Tasks 2, 3, 4 ✓ (`vote`/`mention`/`notification` tables are later plans, per scope note)
- §5 enum changes (`EntityType` += Vulnerability/Report; new `ModeratedContentType.Comment`) — Task 1 ✓
- §8 `CommentModerationTarget` registered in `ModerationTargetRegistry`, mirrors Rating target incl. cache invalidation — Tasks 6, 7 ✓
- §7 single-level threading storage (`ParentCommentId`) — Task 2 model + Task 5 `ListByEntity` returns top-level only ✓
- §11 soft delete — Task 5 `SoftDelete` ✓

**Deliberately deferred to later plans** (not gaps): content filter on write, `ContentHtml` population, voting, mentions, notifications/SignalR, controller/service/API, frontend. `EditHistory`/`ContentHtml` columns exist now but are populated when the write API lands.

**Placeholder scan:** none — every step has concrete code or an exact command + expected output.

**Type consistency:** `ICommentProcessor.ListByEntity(EntityType, int, int, int, bool)` signature matches its test call; `CommentCacheKeys.Count(EntityType, int)` matches both the target and its test; `CommentModerationTarget(IDbContextFactory<Db>, IDistributedCache)` ctor matches all test call sites; `db.Comment` DbSet name matches Task 3. Consistent.

## Next plans (after this lands)
2. Comment CRUD API + `CommentService` + content filter on write + count cache + `CommentsController` (spec §6, §8 filter).
3. Voting (`vote` table, endpoint, reputation hook). 4. Mentions (`mention` table, `/users/search`). 5. SignalR + notifications backbone. 6–8. Frontend (components, Discussion tabs, bell, `/mentions`).

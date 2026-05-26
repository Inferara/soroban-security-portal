# Comment Voting — Implementation Plan (PR3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stack-Overflow-style up/down voting on comments — one vote per user per comment, togg;eable/clearable, with denormalized counts on the comment kept consistent atomically, and the current user's vote surfaced in the comment list.

**Architecture:** `CommentsController POST /{id}/vote → IVoteService.Vote → IVoteProcessor.SetCommentVote → Db` (single DbContext / one SaveChanges = atomic vote-row + comment-count update). A generic `vote` table (extensible to forum posts). `CommentService.GetComments` gains vote enrichment (`CurrentUserVote`) via `IVoteProcessor`. Mirrors the rating/comment stack.

**Tech Stack:** ASP.NET Core, EF Core (PostgreSQL), AutoMapper, xUnit + Moq + FluentAssertions. Branch `feature/comments-discussion`. Baseline: 248 tests green.

**Scope:** vote table + set/clear vote + atomic comment counts + self-vote prevention + `CurrentUserVote` enrichment + POST endpoint. **Excludes (PR3b):** reputation coupling — author `+1` per upvote and min-reputation-to-downvote (isolated follow-up; overlaps the future Reputation engine #7). **Excludes (PR7):** the `CommentVoteButtons` frontend.

---

### Task 1: VoteModel + enums + migration

**Files:**
- Create: `Backend/SorobanSecurityPortalApi/Models/DbModels/VoteModel.cs`
- Modify: `Backend/SorobanSecurityPortalApi/Common/Data/Db.cs` (DbSet + indexes)
- Modify: `Backend/SorobanSecurityPortalApi/appsettings.json` (ProductVersion bump)
- Create (via EF CLI): `Migrations/<ts>_AddVotes.cs` (+ Designer + snapshot)

- [ ] **Step 1: Create the model + enums**

`VoteModel.cs`:

```csharp
using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SorobanSecurityPortalApi.Models.DbModels
{
    // Generic vote target type (extensible — ForumPost reserved for later forum voting).
    public enum VotableEntityType
    {
        Comment = 1,
        ForumPost = 2
    }

    public enum VoteType
    {
        Upvote = 1,
        Downvote = 2
    }

    [Table("vote")]
    public class VoteModel
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int UserId { get; set; }

        [Required]
        public VotableEntityType EntityType { get; set; }

        [Required]
        public int EntityId { get; set; }

        [Required]
        public VoteType VoteType { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
```

- [ ] **Step 2: Register the DbSet + indexes**

In `Db.cs`, after the `Comment` DbSet line add:

```csharp
        public virtual DbSet<VoteModel> Vote { get; set; }
```

In `OnModelCreating` (the builder parameter is named `builder`), after the comment index block add:

```csharp
            builder.Entity<VoteModel>()
                .HasIndex(v => new { v.UserId, v.EntityType, v.EntityId })
                .IsUnique();
            builder.Entity<VoteModel>()
                .HasIndex(v => new { v.EntityType, v.EntityId });
```

- [ ] **Step 3: Bump ProductVersion**

In `appsettings.json` change `"ProductVersion": "1.20"` → `"ProductVersion": "1.21"` (so the startup migration runner applies `AddVotes` on deploy; gate is `config.ProductVersion != db version`).

- [ ] **Step 4: Generate the migration**

```bash
cd Backend/SorobanSecurityPortalApi
dotnet ef migrations add AddVotes --context Db
cd ../..
```
Verify the new `<ts>_AddVotes.cs` creates table `vote` with snake_case columns (`user_id`, `entity_type`, `entity_id`, `vote_type`, `created_at`), a UNIQUE index `ix_vote_user_id_entity_type_entity_id`, and `ix_vote_entity_type_entity_id`; and that `DbModelSnapshot.cs` was updated. If the snapshot didn't change, STOP — delete and regenerate (do not hand-write).

- [ ] **Step 5: Build + commit**

Run: `dotnet build Backend/SorobanSecurityPortalApi/SorobanSecurityPortalApi.csproj -v quiet --nologo` → 0 errors.

```bash
git add Backend/SorobanSecurityPortalApi/Models/DbModels/VoteModel.cs Backend/SorobanSecurityPortalApi/Common/Data/Db.cs Backend/SorobanSecurityPortalApi/appsettings.json Backend/SorobanSecurityPortalApi/Migrations/
git commit -m "feat(comments): add vote table + migration; bump ProductVersion to 1.21"
```
(Append `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>` to every commit.)

---

### Task 2: VoteProcessor (TDD)

**Files:**
- Create: `Backend/SorobanSecurityPortalApi/Data/Processors/VoteProcessor.cs`
- Create: `Backend/SorobanSecurityPortalApi.Tests/Data/VoteProcessorTests.cs`

`SetCommentVote` does the whole mutation in ONE DbContext (load comment + load existing vote + adjust denormalized counts + upsert/remove the vote row) → a single `SaveChangesAsync` is atomic. `VoteOutcome` reports facts; the service maps them to HTTP results.

- [ ] **Step 1: Write the failing tests**

`VoteProcessorTests.cs` (uses the `Mock<Db>` async pattern; reuse `TestAsyncQueryProvider`/`TestAsyncEnumerator` from `SorobanSecurityPortalApi.Tests.Services`):

```csharp
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
    public class VoteProcessorTests
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
            m.Setup(d => d.Remove(It.IsAny<T>())).Callback<T>(t => src.Remove(t));
            return m;
        }

        private static (Mock<IDbContextFactory<Db>>, Mock<Db>) Factory(List<CommentModel> comments, List<VoteModel> votes)
        {
            var db = new Mock<Db>(
                new Mock<IDbQuery>().Object,
                new Mock<Microsoft.Extensions.Logging.ILogger<Db>>().Object,
                new Mock<IDataSourceProvider>().Object) { CallBase = true };
            db.Setup(d => d.Comment).Returns(Set(comments).Object);
            db.Setup(d => d.Vote).Returns(Set(votes).Object);
            db.Setup(d => d.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
            var f = new Mock<IDbContextFactory<Db>>();
            f.Setup(x => x.CreateDbContextAsync(It.IsAny<CancellationToken>())).ReturnsAsync(db.Object);
            return (f, db);
        }

        [Fact]
        public async Task SetCommentVote_New_Upvote_Increments_And_AddsRow()
        {
            var comment = new CommentModel { Id = 1, AuthorId = 9, UpvoteCount = 0, DownvoteCount = 0 };
            var votes = new List<VoteModel>();
            var (f, db) = Factory(new List<CommentModel> { comment }, votes);

            var outcome = await new VoteProcessor(f.Object).SetCommentVote(1, userId: 5, newVote: VoteType.Upvote);

            outcome.Should().NotBeNull();
            outcome!.IsSelfVote.Should().BeFalse();
            outcome.UpvoteCount.Should().Be(1);
            outcome.CurrentUserVote.Should().Be(VoteType.Upvote);
            votes.Should().ContainSingle();
            comment.UpvoteCount.Should().Be(1);
            db.Verify(d => d.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task SetCommentVote_Flip_Up_To_Down_Adjusts_Both_Counts()
        {
            var comment = new CommentModel { Id = 1, AuthorId = 9, UpvoteCount = 1, DownvoteCount = 0 };
            var votes = new List<VoteModel> { new() { Id = 1, UserId = 5, EntityType = VotableEntityType.Comment, EntityId = 1, VoteType = VoteType.Upvote } };
            var (f, _) = Factory(new List<CommentModel> { comment }, votes);

            var outcome = await new VoteProcessor(f.Object).SetCommentVote(1, 5, VoteType.Downvote);

            comment.UpvoteCount.Should().Be(0);
            comment.DownvoteCount.Should().Be(1);
            outcome!.CurrentUserVote.Should().Be(VoteType.Downvote);
            votes.Should().ContainSingle(); // same row, flipped
            votes[0].VoteType.Should().Be(VoteType.Downvote);
        }

        [Fact]
        public async Task SetCommentVote_Clear_Removes_Row_And_Decrements()
        {
            var comment = new CommentModel { Id = 1, AuthorId = 9, UpvoteCount = 1, DownvoteCount = 0 };
            var votes = new List<VoteModel> { new() { Id = 1, UserId = 5, EntityType = VotableEntityType.Comment, EntityId = 1, VoteType = VoteType.Upvote } };
            var (f, _) = Factory(new List<CommentModel> { comment }, votes);

            var outcome = await new VoteProcessor(f.Object).SetCommentVote(1, 5, newVote: null);

            comment.UpvoteCount.Should().Be(0);
            outcome!.CurrentUserVote.Should().BeNull();
            votes.Should().BeEmpty();
        }

        [Fact]
        public async Task SetCommentVote_Returns_Null_For_Missing_Comment()
        {
            var (f, _) = Factory(new List<CommentModel>(), new List<VoteModel>());
            (await new VoteProcessor(f.Object).SetCommentVote(999, 5, VoteType.Upvote)).Should().BeNull();
        }

        [Fact]
        public async Task SetCommentVote_SelfVote_Is_Reported_And_NotApplied()
        {
            var comment = new CommentModel { Id = 1, AuthorId = 5, UpvoteCount = 0 };
            var votes = new List<VoteModel>();
            var (f, db) = Factory(new List<CommentModel> { comment }, votes);

            var outcome = await new VoteProcessor(f.Object).SetCommentVote(1, userId: 5, VoteType.Upvote);

            outcome!.IsSelfVote.Should().BeTrue();
            comment.UpvoteCount.Should().Be(0);
            votes.Should().BeEmpty();
            db.Verify(d => d.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task GetUserVotesForComments_Returns_Map()
        {
            var votes = new List<VoteModel>
            {
                new() { UserId = 5, EntityType = VotableEntityType.Comment, EntityId = 1, VoteType = VoteType.Upvote },
                new() { UserId = 5, EntityType = VotableEntityType.Comment, EntityId = 2, VoteType = VoteType.Downvote },
                new() { UserId = 6, EntityType = VotableEntityType.Comment, EntityId = 1, VoteType = VoteType.Upvote },
            };
            var (f, _) = Factory(new List<CommentModel>(), votes);

            var map = await new VoteProcessor(f.Object).GetUserVotesForComments(5, new List<int> { 1, 2 });

            map[1].Should().Be(VoteType.Upvote);
            map[2].Should().Be(VoteType.Downvote);
            map.Should().HaveCount(2);
        }
    }
}
```

- [ ] **Step 2: Run → expect FAIL** — `dotnet test Backend/SorobanSecurityPortalApi.Tests --filter "FullyQualifiedName~VoteProcessorTests"` (VoteProcessor missing).

- [ ] **Step 3: Implement `VoteProcessor` + `VoteOutcome`**

`VoteProcessor.cs`:

```csharp
using Microsoft.EntityFrameworkCore;
using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Models.DbModels;

namespace SorobanSecurityPortalApi.Data.Processors
{
    public class VoteOutcome
    {
        public bool IsSelfVote { get; set; }
        public int UpvoteCount { get; set; }
        public int DownvoteCount { get; set; }
        public VoteType? CurrentUserVote { get; set; }
    }

    public class VoteProcessor : IVoteProcessor
    {
        private readonly IDbContextFactory<Db> _dbFactory;
        public VoteProcessor(IDbContextFactory<Db> dbFactory) => _dbFactory = dbFactory;

        public async Task<VoteOutcome?> SetCommentVote(int commentId, int userId, VoteType? newVote)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var comment = await db.Comment.FirstOrDefaultAsync(c => c.Id == commentId);
            if (comment == null) return null;

            // Voting on your own comment is not allowed (protects the count + future reputation).
            if (comment.AuthorId == userId)
                return new VoteOutcome { IsSelfVote = true, UpvoteCount = comment.UpvoteCount, DownvoteCount = comment.DownvoteCount };

            var existing = await db.Vote.FirstOrDefaultAsync(
                v => v.UserId == userId && v.EntityType == VotableEntityType.Comment && v.EntityId == commentId);
            var oldVote = existing?.VoteType;

            comment.UpvoteCount += (newVote == VoteType.Upvote ? 1 : 0) - (oldVote == VoteType.Upvote ? 1 : 0);
            comment.DownvoteCount += (newVote == VoteType.Downvote ? 1 : 0) - (oldVote == VoteType.Downvote ? 1 : 0);

            if (newVote == null)
            {
                if (existing != null) db.Vote.Remove(existing);
            }
            else if (existing != null)
            {
                existing.VoteType = newVote.Value;
            }
            else
            {
                db.Vote.Add(new VoteModel
                {
                    UserId = userId,
                    EntityType = VotableEntityType.Comment,
                    EntityId = commentId,
                    VoteType = newVote.Value
                });
            }

            await db.SaveChangesAsync();
            return new VoteOutcome
            {
                IsSelfVote = false,
                UpvoteCount = comment.UpvoteCount,
                DownvoteCount = comment.DownvoteCount,
                CurrentUserVote = newVote
            };
        }

        public async Task<Dictionary<int, VoteType>> GetUserVotesForComments(int userId, List<int> commentIds)
        {
            if (commentIds == null || commentIds.Count == 0) return new Dictionary<int, VoteType>();
            await using var db = await _dbFactory.CreateDbContextAsync();
            var rows = await db.Vote.AsNoTracking()
                .Where(v => v.UserId == userId && v.EntityType == VotableEntityType.Comment && commentIds.Contains(v.EntityId))
                .Select(v => new { v.EntityId, v.VoteType })
                .ToListAsync();
            return rows.ToDictionary(r => r.EntityId, r => r.VoteType);
        }
    }

    public interface IVoteProcessor
    {
        Task<VoteOutcome?> SetCommentVote(int commentId, int userId, VoteType? newVote);
        Task<Dictionary<int, VoteType>> GetUserVotesForComments(int userId, List<int> commentIds);
    }
}
```

- [ ] **Step 4: Run → expect PASS** (6 VoteProcessor tests). Then build (0 errors).

- [ ] **Step 5: Commit**

```bash
git add Backend/SorobanSecurityPortalApi/Data/Processors/VoteProcessor.cs Backend/SorobanSecurityPortalApi.Tests/Data/VoteProcessorTests.cs
git commit -m "feat(comments): add VoteProcessor (atomic comment vote + vote map) with tests"
```

---

### Task 3: VoteService + CurrentUserVote enrichment (TDD)

**Files:**
- Create: `Backend/SorobanSecurityPortalApi/Services/ControllersServices/VoteService.cs`
- Create: `Backend/SorobanSecurityPortalApi.Tests/Services/VoteServiceTests.cs`
- Modify: `Backend/SorobanSecurityPortalApi/Models/ViewModels/CommentViewModel.cs` (+`CurrentUserVote`)
- Modify: `Backend/SorobanSecurityPortalApi/Services/ControllersServices/CommentService.cs` (inject `IVoteProcessor`, enrich)
- Modify: `Backend/SorobanSecurityPortalApi.Tests/Services/CommentServiceTests.cs` (Build() gains a vote-processor mock)
- Modify: `Backend/SorobanSecurityPortalApi/Startup.cs` (register `IVoteService`)

- [ ] **Step 1: Add `CurrentUserVote` to the DTO**

In `CommentViewModel.cs`, add to `CommentViewModel`:

```csharp
        // "upvote" | "downvote" | null — the requesting user's current vote on this comment.
        public string? CurrentUserVote { get; set; }
```

- [ ] **Step 2: Write the failing VoteService tests**

`VoteServiceTests.cs`:

```csharp
using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using FluentAssertions;
using Moq;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Services.ControllersServices;
using Xunit;

namespace SorobanSecurityPortalApi.Tests.Services
{
    public class VoteServiceTests
    {
        private readonly Mock<IVoteProcessor> _processor = new();
        private readonly Mock<IUserContextAccessor> _userContext = new();
        private VoteService Build() => new VoteService(_processor.Object, _userContext.Object);

        [Fact]
        public async Task Vote_Rejects_Unauthenticated()
        {
            _userContext.Setup(u => u.GetLoginIdAsync()).ReturnsAsync(0);
            await Build().Invoking(s => s.Vote(1, "upvote")).Should().ThrowAsync<UnauthorizedAccessException>();
        }

        [Fact]
        public async Task Vote_Rejects_Invalid_VoteType()
        {
            _userContext.Setup(u => u.GetLoginIdAsync()).ReturnsAsync(5);
            await Build().Invoking(s => s.Vote(1, "sideways")).Should().ThrowAsync<InvalidOperationException>();
        }

        [Fact]
        public async Task Vote_Maps_None_To_Clear()
        {
            _userContext.Setup(u => u.GetLoginIdAsync()).ReturnsAsync(5);
            _processor.Setup(p => p.SetCommentVote(1, 5, null))
                .ReturnsAsync(new VoteOutcome { UpvoteCount = 0, DownvoteCount = 0, CurrentUserVote = null });

            var result = await Build().Vote(1, "none");

            result.CurrentUserVote.Should().BeNull();
            _processor.Verify(p => p.SetCommentVote(1, 5, null), Times.Once);
        }

        [Fact]
        public async Task Vote_Upvote_Returns_Counts_And_State()
        {
            _userContext.Setup(u => u.GetLoginIdAsync()).ReturnsAsync(5);
            _processor.Setup(p => p.SetCommentVote(1, 5, VoteType.Upvote))
                .ReturnsAsync(new VoteOutcome { UpvoteCount = 3, DownvoteCount = 1, CurrentUserVote = VoteType.Upvote });

            var result = await Build().Vote(1, "upvote");

            result.UpvoteCount.Should().Be(3);
            result.DownvoteCount.Should().Be(1);
            result.CurrentUserVote.Should().Be("upvote");
        }

        [Fact]
        public async Task Vote_Throws_NotFound_When_Comment_Missing()
        {
            _userContext.Setup(u => u.GetLoginIdAsync()).ReturnsAsync(5);
            _processor.Setup(p => p.SetCommentVote(99, 5, VoteType.Upvote)).ReturnsAsync((VoteOutcome?)null);
            await Build().Invoking(s => s.Vote(99, "upvote")).Should().ThrowAsync<KeyNotFoundException>();
        }

        [Fact]
        public async Task Vote_Throws_When_SelfVote()
        {
            _userContext.Setup(u => u.GetLoginIdAsync()).ReturnsAsync(5);
            _processor.Setup(p => p.SetCommentVote(1, 5, VoteType.Upvote)).ReturnsAsync(new VoteOutcome { IsSelfVote = true });
            await Build().Invoking(s => s.Vote(1, "upvote")).Should().ThrowAsync<InvalidOperationException>();
        }
    }
}
```

- [ ] **Step 3: Run → expect FAIL** — `--filter "FullyQualifiedName~VoteServiceTests"`.

- [ ] **Step 4: Implement `VoteService` + `VoteResultViewModel`**

Add `VoteResultViewModel` to `CommentViewModel.cs`:

```csharp
    public class VoteResultViewModel
    {
        public int UpvoteCount { get; set; }
        public int DownvoteCount { get; set; }
        public string? CurrentUserVote { get; set; }
    }
```

`VoteService.cs`:

```csharp
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;

namespace SorobanSecurityPortalApi.Services.ControllersServices
{
    public interface IVoteService
    {
        Task<VoteResultViewModel> Vote(int commentId, string voteType);
    }

    public class VoteService : IVoteService
    {
        private readonly IVoteProcessor _processor;
        private readonly IUserContextAccessor _userContext;

        public VoteService(IVoteProcessor processor, IUserContextAccessor userContext)
        {
            _processor = processor;
            _userContext = userContext;
        }

        public async Task<VoteResultViewModel> Vote(int commentId, string voteType)
        {
            var userId = await _userContext.GetLoginIdAsync();
            if (userId == 0) throw new UnauthorizedAccessException("User not logged in.");

            VoteType? parsed = (voteType ?? "").ToLowerInvariant() switch
            {
                "upvote" => VoteType.Upvote,
                "downvote" => VoteType.Downvote,
                "none" => null,
                _ => throw new InvalidOperationException("voteType must be 'upvote', 'downvote', or 'none'.")
            };

            var outcome = await _processor.SetCommentVote(commentId, userId, parsed);
            if (outcome == null) throw new KeyNotFoundException($"Comment with id {commentId} not found.");
            if (outcome.IsSelfVote) throw new InvalidOperationException("You cannot vote on your own comment.");

            return new VoteResultViewModel
            {
                UpvoteCount = outcome.UpvoteCount,
                DownvoteCount = outcome.DownvoteCount,
                CurrentUserVote = ToStr(outcome.CurrentUserVote)
            };
        }

        internal static string? ToStr(VoteType? v) => v switch
        {
            VoteType.Upvote => "upvote",
            VoteType.Downvote => "downvote",
            _ => null
        };
    }
}
```

- [ ] **Step 5: Run VoteServiceTests → expect PASS** (6 tests).

- [ ] **Step 6: Enrich `CommentService.GetComments` with `CurrentUserVote`**

In `CommentService.cs`: add `using SorobanSecurityPortalApi.Models.DbModels;` if not present, add the `IVoteProcessor` dependency to the constructor (and field), and after building the list, enrich votes for the authenticated user. Constructor — add `IVoteProcessor voteProcessor` as the last parameter and assign `_voteProcessor`. Then in `GetComments`, AFTER the `result` list is built and BEFORE returning it, insert:

```csharp
            // Surface the requesting user's own vote on each comment (anonymous → skipped).
            var viewerId = await _userContext.GetLoginIdAsync();
            if (viewerId != 0)
            {
                var allIds = result.Select(c => c.Id).Concat(result.SelectMany(c => c.Replies).Select(r => r.Id)).ToList();
                var myVotes = await _voteProcessor.GetUserVotesForComments(viewerId, allIds);
                void Apply(CommentViewModel c)
                {
                    if (myVotes.TryGetValue(c.Id, out var vt)) c.CurrentUserVote = VoteService.ToStr(vt);
                }
                foreach (var c in result) { Apply(c); foreach (var r in c.Replies) Apply(r); }
            }
            return result;
```

(Replace the existing `return result;` at the end of `GetComments` with the block above.)

- [ ] **Step 7: Update `CommentServiceTests` to supply the new dependency**

In `CommentServiceTests.cs`, add a field `private readonly Mock<IVoteProcessor> _voteProcessor = new();` and pass `_voteProcessor.Object` as the new last argument in the `Build()` helper's `new CommentService(...)`. The existing GetComments tests do not set up `GetLoginIdAsync`, so it returns `0` (anonymous) → vote enrichment is skipped → those tests are unaffected. (No assertion changes needed.)

- [ ] **Step 8: Register `IVoteService`** in `Startup.cs` — add next to the `ICommentService` registration:

```csharp
        services.AddScoped<IVoteService, VoteService>();
```
(`IVoteProcessor` auto-registers via the `^I.*Processor$` convention.)

- [ ] **Step 9: Build + run both filters + commit**

Run: `dotnet build ...` (0 errors); `dotnet test Backend/SorobanSecurityPortalApi.Tests --filter "FullyQualifiedName~VoteServiceTests|FullyQualifiedName~CommentServiceTests"` → all pass.

```bash
git add Backend/SorobanSecurityPortalApi/Services/ControllersServices/VoteService.cs Backend/SorobanSecurityPortalApi/Services/ControllersServices/CommentService.cs Backend/SorobanSecurityPortalApi/Models/ViewModels/CommentViewModel.cs Backend/SorobanSecurityPortalApi/Startup.cs Backend/SorobanSecurityPortalApi.Tests/Services/VoteServiceTests.cs Backend/SorobanSecurityPortalApi.Tests/Services/CommentServiceTests.cs
git commit -m "feat(comments): add VoteService + currentUserVote enrichment with tests"
```

---

### Task 4: Vote endpoint + full suite

**Files:**
- Modify: `Backend/SorobanSecurityPortalApi/Controllers/CommentsController.cs`

- [ ] **Step 1: Add the endpoint + request DTO**

Add a request DTO to `CommentViewModel.cs`:

```csharp
    public class VoteRequest
    {
        public string VoteType { get; set; } = string.Empty;
    }
```

Inject `IVoteService` into `CommentsController` (add a field + constructor parameter alongside `ICommentService`), then add:

```csharp
        [HttpPost("{id}/vote")]
        [Authorize]
        public async Task<IActionResult> Vote(int id, [FromBody] VoteRequest request)
        {
            if (id <= 0) return BadRequest("Comment ID must be a positive integer.");
            if (request == null) return BadRequest("Request body cannot be null.");
            try
            {
                var result = await _voteService.Vote(id, request.VoteType);
                return Ok(result);
            }
            catch (KeyNotFoundException) { return NotFound($"Comment with id {id} not found."); }
            catch (InvalidOperationException ex) { return BadRequest(ex.Message); }
        }
```

(Constructor becomes `public CommentsController(ICommentService commentService, IVoteService voteService)` with both fields assigned.)

- [ ] **Step 2: Build** → 0 errors.

- [ ] **Step 3: Full suite** — `dotnet test Backend/SorobanSecurityPortalApi.Tests` → 0 failures. Total = 248 + 6 (VoteProcessor) + 6 (VoteService) = **260**.

- [ ] **Step 4: Commit**

```bash
git add Backend/SorobanSecurityPortalApi/Controllers/CommentsController.cs Backend/SorobanSecurityPortalApi/Models/ViewModels/CommentViewModel.cs
git commit -m "feat(comments): add POST /comments/{id}/vote endpoint"
```

---

## Self-Review

**Spec coverage (#80, voting-mechanics slice):** `VoteModel` + unique constraint (Task 1); POST `/comments/{id}/vote` with `{voteType: upvote|downvote|none}` (Task 4); toggle/clear by re-sending the desired state (Task 2/3 — backend persists the requested state, frontend decides toggling); atomic count update (Task 2 single SaveChanges); net score via exposed `UpvoteCount`/`DownvoteCount`; highlight current vote via `CurrentUserVote` (Task 3); self-vote prevention (Task 2). **Reputation (+1/upvote, min-rep-to-downvote) deferred to PR3b. CommentVoteButtons UI → PR7.**

**Placeholder scan:** none — concrete code + exact commands throughout.

**Type consistency:** `IVoteProcessor.SetCommentVote(int,int,VoteType?)` + `GetUserVotesForComments(int,List<int>)` match the service + tests; `VoteOutcome { IsSelfVote, UpvoteCount, DownvoteCount, CurrentUserVote }` consistent across processor/service; `VoteService.ToStr` reused by `CommentService` enrichment; `VoteResultViewModel`/`VoteRequest` match the controller. `CommentService` ctor gains `IVoteProcessor` (last param) — `CommentServiceTests.Build()` updated to match.

## Next plans
PR3b: reputation coupling (author +1/upvote via `UserProfiles.ReputationScore`, min-reputation-to-downvote). PR4 mentions. PR5 SignalR + notifications. PR6-8 frontend.

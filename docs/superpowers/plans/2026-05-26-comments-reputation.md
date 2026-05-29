# Comment Vote Reputation Coupling — Implementation Plan (PR3b)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete #80's reputation rules — a comment author earns `+1` reputation per upvote received (reversed when the upvote is removed/flipped), and a user must have at least a minimum reputation to cast a downvote — using the existing `UserProfileModel.ReputationScore`.

**Architecture:** Both rules live inside `VoteProcessor.SetCommentVote` (the existing atomic single-`SaveChanges` transaction), so the author's reputation change commits together with the vote and counts. The downvote gate reports a `BelowDownvoteThreshold` flag that `VoteService` maps to a 400. Authors without a `UserProfile` row simply don't accrue reputation (no row is created here).

**Tech Stack:** ASP.NET Core, EF Core (PostgreSQL), xUnit + Moq + FluentAssertions. Branch `feature/comments-discussion`. Baseline: 264 tests green.

**Scope:** author +1/upvote (delta, reversible) + min-rep-to-downvote. **No schema change** (`ReputationScore` already exists). **Excludes:** reputation clawback when a comment is later hidden/deleted (known limitation — see Carry-forwards); the broader Reputation engine #7; vote UI (PR7).

**Product note:** `MinReputationToDownvote` is a tunable constant set to **10**. Because reputation currently accrues only from comment upvotes, this means only users who've earned ≥10 upvotes can downvote at launch. Adjust the constant to taste.

---

### Task 1: Reputation logic in VoteProcessor (TDD)

**Files:**
- Modify: `Backend/SorobanSecurityPortalApi/Data/Processors/VoteProcessor.cs` (add `BelowDownvoteThreshold` to `VoteOutcome`; add the const; downvote gate + author-rep adjustment inside `SetCommentVote`)
- Modify: `Backend/SorobanSecurityPortalApi.Tests/Data/VoteProcessorTests.cs` (extend the `Factory` helper with `UserProfiles`; update the existing flip test to give the voter enough reputation; add new tests)

`UserProfileModel` lives at `Models/DbModels/UserProfileModel.cs` with `LoginId` (int) + `ReputationScore` (int). `Db.UserProfiles` is the DbSet (it is NOT `virtual`, so in tests assign it directly: `db.Object.UserProfiles = Set(profiles).Object` — same pattern `RatingServiceTests` uses for `Login`).

- [ ] **Step 1: Add `BelowDownvoteThreshold` to `VoteOutcome`**

In `VoteProcessor.cs`, add to the `VoteOutcome` class:

```csharp
        public bool BelowDownvoteThreshold { get; set; }
```

- [ ] **Step 2: Update the test `Factory` to provide `UserProfiles`, and update the existing flip test**

In `VoteProcessorTests.cs`, change the `Factory` helper signature + body to also set up `UserProfiles` (default empty), and (because the downvote gate is being added) give the voter enough reputation in the existing flip test.

Replace the existing `Factory` method with:

```csharp
        private static (Mock<IDbContextFactory<Db>>, Mock<Db>) Factory(
            List<CommentModel> comments, List<VoteModel> votes, List<UserProfileModel>? profiles = null)
        {
            var db = new Mock<Db>(
                new Mock<IDbQuery>().Object,
                new Mock<Microsoft.Extensions.Logging.ILogger<Db>>().Object,
                new Mock<IDataSourceProvider>().Object) { CallBase = true };
            db.Setup(d => d.Comment).Returns(Set(comments).Object);
            db.Setup(d => d.Vote).Returns(Set(votes).Object);
            db.Object.UserProfiles = Set(profiles ?? new List<UserProfileModel>()).Object; // UserProfiles is not virtual
            db.Setup(d => d.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
            var f = new Mock<IDbContextFactory<Db>>();
            f.Setup(x => x.CreateDbContextAsync(It.IsAny<CancellationToken>())).ReturnsAsync(db.Object);
            return (f, db);
        }
```

Then update `SetCommentVote_Flip_Up_To_Down_Adjusts_Both_Counts` (the voter, user 5, now needs ≥10 reputation to be allowed to downvote). Change its factory line to pass a profile:

```csharp
            var (f, _) = Factory(new List<CommentModel> { comment }, votes,
                new List<UserProfileModel> { new() { LoginId = 5, ReputationScore = 50 } });
```

(Add `using SorobanSecurityPortalApi.Models.DbModels;` if not already imported — it is, since the tests use `CommentModel`/`VoteModel`.)

- [ ] **Step 3: Write the new failing tests**

Append to `VoteProcessorTests.cs`:

```csharp
        [Fact]
        public async Task SetCommentVote_Upvote_Credits_Author_Reputation()
        {
            var comment = new CommentModel { Id = 1, AuthorId = 9 };
            var author = new UserProfileModel { LoginId = 9, ReputationScore = 0 };
            var (f, _) = Factory(new List<CommentModel> { comment }, new List<VoteModel>(),
                new List<UserProfileModel> { author });

            await new VoteProcessor(f.Object).SetCommentVote(1, userId: 5, VoteType.Upvote);

            author.ReputationScore.Should().Be(1);
        }

        [Fact]
        public async Task SetCommentVote_Clearing_Upvote_Debits_Author_Reputation()
        {
            var comment = new CommentModel { Id = 1, AuthorId = 9, UpvoteCount = 1 };
            var author = new UserProfileModel { LoginId = 9, ReputationScore = 1 };
            var votes = new List<VoteModel> { new() { Id = 1, UserId = 5, EntityType = VotableEntityType.Comment, EntityId = 1, VoteType = VoteType.Upvote } };
            var (f, _) = Factory(new List<CommentModel> { comment }, votes, new List<UserProfileModel> { author });

            await new VoteProcessor(f.Object).SetCommentVote(1, 5, newVote: null);

            author.ReputationScore.Should().Be(0);
        }

        [Fact]
        public async Task SetCommentVote_Downvote_Does_Not_Change_Author_Reputation()
        {
            var comment = new CommentModel { Id = 1, AuthorId = 9 };
            var author = new UserProfileModel { LoginId = 9, ReputationScore = 0 };
            var voter = new UserProfileModel { LoginId = 5, ReputationScore = 50 };
            var (f, _) = Factory(new List<CommentModel> { comment }, new List<VoteModel>(),
                new List<UserProfileModel> { author, voter });

            await new VoteProcessor(f.Object).SetCommentVote(1, 5, VoteType.Downvote);

            author.ReputationScore.Should().Be(0);
        }

        [Fact]
        public async Task SetCommentVote_Author_Without_Profile_Skips_Reputation_But_Succeeds()
        {
            var comment = new CommentModel { Id = 1, AuthorId = 9 };
            var (f, db) = Factory(new List<CommentModel> { comment }, new List<VoteModel>()); // no profiles

            var outcome = await new VoteProcessor(f.Object).SetCommentVote(1, 5, VoteType.Upvote);

            outcome!.UpvoteCount.Should().Be(1);
            db.Verify(d => d.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task SetCommentVote_Downvote_Below_Threshold_Is_Blocked_And_NotApplied()
        {
            var comment = new CommentModel { Id = 1, AuthorId = 9, DownvoteCount = 0 };
            var voter = new UserProfileModel { LoginId = 5, ReputationScore = 3 }; // < 10
            var votes = new List<VoteModel>();
            var (f, db) = Factory(new List<CommentModel> { comment }, votes, new List<UserProfileModel> { voter });

            var outcome = await new VoteProcessor(f.Object).SetCommentVote(1, 5, VoteType.Downvote);

            outcome!.BelowDownvoteThreshold.Should().BeTrue();
            comment.DownvoteCount.Should().Be(0);
            votes.Should().BeEmpty();
            db.Verify(d => d.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task SetCommentVote_Downvote_With_Enough_Reputation_Succeeds()
        {
            var comment = new CommentModel { Id = 1, AuthorId = 9 };
            var voter = new UserProfileModel { LoginId = 5, ReputationScore = 10 }; // == threshold
            var (f, _) = Factory(new List<CommentModel> { comment }, new List<VoteModel>(),
                new List<UserProfileModel> { voter });

            var outcome = await new VoteProcessor(f.Object).SetCommentVote(1, 5, VoteType.Downvote);

            outcome!.BelowDownvoteThreshold.Should().BeFalse();
            outcome.DownvoteCount.Should().Be(1);
        }
```

- [ ] **Step 4: Run → expect FAIL** — `dotnet test Backend/SorobanSecurityPortalApi.Tests --filter "FullyQualifiedName~VoteProcessorTests"` (rep assertions fail; threshold not enforced).

- [ ] **Step 5: Implement in `VoteProcessor.SetCommentVote`**

Add the const to the `VoteProcessor` class:

```csharp
        // Minimum reputation required to cast a downvote (abuse prevention). Tunable.
        public const int MinReputationToDownvote = 10;
```

In `SetCommentVote`, AFTER loading `existing`/`oldVote` and BEFORE the vote-row mutation block, add the downvote gate:

```csharp
            // Min-reputation gate: only applies when newly casting a downvote.
            if (newVote == VoteType.Downvote && oldVote != VoteType.Downvote)
            {
                var voterRep = await db.UserProfiles.AsNoTracking()
                    .Where(p => p.LoginId == userId)
                    .Select(p => (int?)p.ReputationScore)
                    .FirstOrDefaultAsync() ?? 0;
                if (voterRep < MinReputationToDownvote)
                    return new VoteOutcome
                    {
                        BelowDownvoteThreshold = true,
                        UpvoteCount = comment.UpvoteCount,
                        DownvoteCount = comment.DownvoteCount,
                        CurrentUserVote = oldVote
                    };
            }
```

AFTER the recompute of `comment.UpvoteCount`/`DownvoteCount` and BEFORE `SaveChangesAsync`, add the author-reputation adjustment:

```csharp
            // Author earns +1 reputation per upvote on their comment (reversed when the upvote
            // is removed or flipped). Authors without a profile row simply don't accrue any.
            var repDelta = (newVote == VoteType.Upvote ? 1 : 0) - (oldVote == VoteType.Upvote ? 1 : 0);
            if (repDelta != 0)
            {
                var authorProfile = await db.UserProfiles.FirstOrDefaultAsync(p => p.LoginId == comment.AuthorId);
                if (authorProfile != null) authorProfile.ReputationScore += repDelta;
            }
```

- [ ] **Step 6: Run → expect PASS** — all VoteProcessor tests (the 9 prior + 6 new = 15) pass. Build (0 errors).

- [ ] **Step 7: Commit**

```bash
git add Backend/SorobanSecurityPortalApi/Data/Processors/VoteProcessor.cs Backend/SorobanSecurityPortalApi.Tests/Data/VoteProcessorTests.cs
git commit -m "feat(comments): author reputation +1/upvote + min-reputation-to-downvote gate"
```
(Append `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>` trailer.)

---

### Task 2: Map the downvote-threshold flag in VoteService (TDD)

**Files:**
- Modify: `Backend/SorobanSecurityPortalApi/Services/ControllersServices/VoteService.cs`
- Modify: `Backend/SorobanSecurityPortalApi.Tests/Services/VoteServiceTests.cs`

- [ ] **Step 1: Write the failing test**

Append to `VoteServiceTests.cs`:

```csharp
        [Fact]
        public async Task Vote_Throws_When_Below_Downvote_Threshold()
        {
            _userContext.Setup(u => u.GetLoginIdAsync()).ReturnsAsync(5);
            _processor.Setup(p => p.SetCommentVote(1, 5, VoteType.Downvote))
                .ReturnsAsync(new VoteOutcome { BelowDownvoteThreshold = true });

            await Build().Invoking(s => s.Vote(1, "downvote"))
                .Should().ThrowAsync<InvalidOperationException>().WithMessage("*reputation*");
        }
```

- [ ] **Step 2: Run → expect FAIL** (the flag is currently ignored, so no throw).

- [ ] **Step 3: Implement** — in `VoteService.Vote`, after the `IsSelfVote` check and before building the result, add:

```csharp
            if (outcome.BelowDownvoteThreshold)
                throw new InvalidOperationException(
                    $"You need at least {VoteProcessor.MinReputationToDownvote} reputation to downvote.");
```

(`VoteProcessor` is in `SorobanSecurityPortalApi.Data.Processors`, already imported by `VoteService`.)

- [ ] **Step 4: Run → expect PASS** (VoteServiceTests: 6 prior + 1 new = 7).

- [ ] **Step 5: Full suite + commit**

Run: `dotnet build ...` (0 errors); `dotnet test Backend/SorobanSecurityPortalApi.Tests` → 0 failures, total = 264 + 6 (processor) + 1 (service) = **271**.

```bash
git add Backend/SorobanSecurityPortalApi/Services/ControllersServices/VoteService.cs Backend/SorobanSecurityPortalApi.Tests/Services/VoteServiceTests.cs
git commit -m "feat(comments): map below-downvote-threshold to 400 in VoteService"
```

---

## Self-Review

**Spec coverage (#80 reputation):** author +1 per upvote via `ReputationScore`, reversed on removal/flip (Task 1 `repDelta`); min-reputation-to-downvote gate (Task 1 const + gate → Task 2 400). Downvotes do not change author reputation; authors without a profile don't accrue (graceful). The vote→rep change is atomic with the vote (same `SaveChanges`).

**Placeholder scan:** none — concrete code + exact commands.

**Type consistency:** `VoteOutcome.BelowDownvoteThreshold` added in Task 1, consumed by `VoteService` in Task 2; `VoteProcessor.MinReputationToDownvote` is `public const`, referenced by both the service and (implicitly via threshold) the tests; the `Factory` helper signature change is backward-compatible (optional `profiles` param) so other VoteProcessor tests keep compiling. The existing flip test is explicitly updated to supply voter reputation.

## Carry-forwards / known limitations
- **No reputation clawback on moderation:** if a comment is upvoted (author credited) and later hidden/soft-deleted, the author keeps the accrued reputation. New votes can't accrue on suppressed comments (PR3 guard), but already-granted reputation isn't reversed. A future change to `CommentModerationTarget.Hide/SoftDelete` (subtract the comment's net upvotes from the author, re-add on Restore) — or the full Reputation engine #7 recompute — should address this.
- **Threshold value (10)** is a product decision; tune `MinReputationToDownvote`.
- Reputation is still only sourced from comment upvotes until the Reputation engine (#7).

## Next plans
PR4 mentions (#75). PR5 SignalR + notifications (#56). PR6-8 frontend.

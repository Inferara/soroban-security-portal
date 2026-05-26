# Wire Notifications into Comment Creation (+ non-fatal side-effects) — Implementation Plan (PR5b)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make reply (#61) and `@mention` (#75) notifications actually fire — `CommentService.AddComment` calls `NotificationService.NotifyForNewComment` after a comment is saved — and make all post-save side-effects (mention storage + notification creation) **non-fatal**, which closes audit finding #1 (a side-effect failure must not 500 the request or orphan a saved comment).

**Architecture:** Consolidate the post-create side-effects (already including mention storage from PR4) into one private `RunCommentSideEffects` helper in `CommentService`, wrapped in try/catch + logging. `AddComment` runs it with notifications; `UpdateComment` runs it without (edits re-index mentions but don't re-notify). Real-time delivery is PR5c (behind `IRealtimePublisher`, not in this PR).

**Tech Stack:** ASP.NET Core, EF Core, xUnit + Moq + FluentAssertions. Branch `feature/comments-discussion`. Baseline: 292 tests green.

**Scope:** `CommentService` wiring + non-fatal side-effects + tests. **Excludes (PR5c):** SignalR hub / Redis backplane / JWT-on-socket / `IRealtimePublisher` real-time push. **Note:** notifications are *persisted* and queryable via the PR5 REST API after this PR; the frontend can poll. Replying to a hidden parent still notifies (minor carry-forward — suppress-on-hidden deferred).

---

### Task 1: Wire notifications + non-fatal side-effects into CommentService (TDD)

**Files:**
- Modify: `Backend/SorobanSecurityPortalApi/Services/ControllersServices/CommentService.cs` (add `INotificationService` + `ILogger<CommentService>` deps; capture replied-to author; consolidate side-effects into a non-fatal helper)
- Modify: `Backend/SorobanSecurityPortalApi.Tests/Services/CommentServiceTests.cs` (inject the two new deps; add tests)

**Current state of `CommentService.AddComment` (PR4):** loads `parent` for flatten; `var saved = await _processor.Add(comment); await _mentionProcessor.ReplaceCommentMentions(saved.Id, request.Content); await InvalidateCount(...)`. `UpdateComment` ends with `await _mentionProcessor.ReplaceCommentMentions(id, content);`.

- [ ] **Step 1: Write the failing tests**

In `CommentServiceTests.cs`, add fields:

```csharp
        private readonly Mock<INotificationService> _notifications = new();
        private readonly Mock<Microsoft.Extensions.Logging.ILogger<CommentService>> _logger = new();
```

Update the `Build()` helper to pass the two new args as the LAST constructor parameters (order: existing… , `_notifications.Object`, `_logger.Object`). Add a default setup in `Build()` so existing tests don't NRE:

```csharp
            _notifications.Setup(n => n.NotifyForNewComment(
                It.IsAny<int>(), It.IsAny<int?>(), It.IsAny<IReadOnlyList<int>>(),
                It.IsAny<int>(), It.IsAny<EntityType>(), It.IsAny<int>(), It.IsAny<string>()))
                .Returns(Task.CompletedTask);
```

Add tests:

```csharp
        [Fact]
        public async Task AddComment_Notifies_Reply_Author_And_Mentions()
        {
            _userContext.Setup(u => u.GetLoginIdAsync()).ReturnsAsync(5);
            _processor.Setup(p => p.EntityExists(EntityType.Report, 9)).ReturnsAsync(true);
            AllowFilter();
            _processor.Setup(p => p.GetAuthorNames(It.IsAny<List<int>>())).ReturnsAsync(new Dictionary<int, string> { { 5, "Alice" } });
            // Reply to comment 50 authored by user 9.
            _processor.Setup(p => p.Get(50)).ReturnsAsync(new CommentModel { Id = 50, AuthorId = 9, ParentCommentId = null, EntityType = EntityType.Report, EntityId = 9 });
            _processor.Setup(p => p.Add(It.IsAny<CommentModel>())).ReturnsAsync((CommentModel c) => { c.Id = 100; return c; });
            _mentionProcessor.Setup(m => m.ReplaceCommentMentions(100, It.IsAny<string>())).ReturnsAsync(new List<int> { 11, 12 });

            await Build().AddComment(new CreateCommentRequest { EntityType = EntityType.Report, EntityId = 9, ParentCommentId = 50, Content = "ping @x @y" });

            _notifications.Verify(n => n.NotifyForNewComment(
                5,                                   // actor
                9,                                   // replied-to author
                It.Is<IReadOnlyList<int>>(l => l.Contains(11) && l.Contains(12)),
                100, EntityType.Report, 9, "ping @x @y"), Times.Once);
        }

        [Fact]
        public async Task AddComment_TopLevel_Notifies_With_Null_ReplyAuthor()
        {
            _userContext.Setup(u => u.GetLoginIdAsync()).ReturnsAsync(5);
            _processor.Setup(p => p.EntityExists(EntityType.Report, 9)).ReturnsAsync(true);
            AllowFilter();
            _processor.Setup(p => p.GetAuthorNames(It.IsAny<List<int>>())).ReturnsAsync(new Dictionary<int, string>());
            _processor.Setup(p => p.Add(It.IsAny<CommentModel>())).ReturnsAsync((CommentModel c) => { c.Id = 100; return c; });
            _mentionProcessor.Setup(m => m.ReplaceCommentMentions(100, It.IsAny<string>())).ReturnsAsync(new List<int>());

            await Build().AddComment(new CreateCommentRequest { EntityType = EntityType.Report, EntityId = 9, Content = "top-level" });

            _notifications.Verify(n => n.NotifyForNewComment(5, null, It.IsAny<IReadOnlyList<int>>(), 100, EntityType.Report, 9, "top-level"), Times.Once);
        }

        [Fact]
        public async Task AddComment_SideEffect_Failure_Is_NonFatal()
        {
            _userContext.Setup(u => u.GetLoginIdAsync()).ReturnsAsync(5);
            _processor.Setup(p => p.EntityExists(EntityType.Report, 9)).ReturnsAsync(true);
            AllowFilter();
            _processor.Setup(p => p.GetAuthorNames(It.IsAny<List<int>>())).ReturnsAsync(new Dictionary<int, string> { { 5, "Alice" } });
            _processor.Setup(p => p.Add(It.IsAny<CommentModel>())).ReturnsAsync((CommentModel c) => { c.Id = 100; return c; });
            // The mention/notification side-effect throws — the comment was already saved.
            _mentionProcessor.Setup(m => m.ReplaceCommentMentions(It.IsAny<int>(), It.IsAny<string>()))
                .ThrowsAsync(new Exception("boom"));

            var vm = await Build().Invoking(s => s.AddComment(new CreateCommentRequest { EntityType = EntityType.Report, EntityId = 9, Content = "hi" }))
                .Should().NotThrowAsync();

            vm.Subject.Id.Should().Be(100); // comment creation still succeeds despite the side-effect failure
            _notifications.Verify(n => n.NotifyForNewComment(It.IsAny<int>(), It.IsAny<int?>(), It.IsAny<IReadOnlyList<int>>(), It.IsAny<int>(), It.IsAny<EntityType>(), It.IsAny<int>(), It.IsAny<string>()), Times.Never); // notify not reached after the throw
        }
```

- [ ] **Step 2: Run → FAIL** — `dotnet test Backend/SorobanSecurityPortalApi.Tests --filter "FullyQualifiedName~CommentServiceTests"` (ctor arity mismatch, NotifyForNewComment never called).

- [ ] **Step 3: Implement in `CommentService.cs`**

Add usings if missing: `using Microsoft.Extensions.Logging;`. Add fields + the two LAST constructor params:

```csharp
        private readonly INotificationService _notificationService;
        private readonly ILogger<CommentService> _logger;
```
(assign both in the constructor; add `INotificationService notificationService, ILogger<CommentService> logger` as the final two parameters).

In `AddComment`, capture the replied-to author inside the existing parent-load block:

```csharp
            int? parentId = null;
            int? repliedToAuthorId = null;
            if (request.ParentCommentId.HasValue)
            {
                var parent = await _processor.Get(request.ParentCommentId.Value);
                if (parent == null || parent.IsDeleted
                    || parent.EntityType != request.EntityType || parent.EntityId != request.EntityId)
                    throw new KeyNotFoundException($"Parent comment {request.ParentCommentId} not found on this entity.");
                parentId = parent.ParentCommentId ?? parent.Id;
                repliedToAuthorId = parent.AuthorId;   // notify the comment actually replied to
            }
```

Replace the existing `await _mentionProcessor.ReplaceCommentMentions(saved.Id, request.Content);` line with:

```csharp
            await RunCommentSideEffects(saved, repliedToAuthorId, request.Content, notify: true);
```

In `UpdateComment`, replace `await _mentionProcessor.ReplaceCommentMentions(id, content);` with:

```csharp
            await RunCommentSideEffects(updated, repliedToAuthorId: null, content, notify: false);
```

Add the private helper (anywhere in the class):

```csharp
        // Mention indexing + notification creation are best-effort: the comment has already been
        // persisted, so a failure here must NOT fail the request or trigger a duplicate retry.
        private async Task RunCommentSideEffects(CommentModel comment, int? repliedToAuthorId, string rawContent, bool notify)
        {
            try
            {
                var mentionedIds = await _mentionProcessor.ReplaceCommentMentions(comment.Id, rawContent);
                if (notify)
                    await _notificationService.NotifyForNewComment(
                        comment.AuthorId, repliedToAuthorId, mentionedIds,
                        comment.Id, comment.EntityType, comment.EntityId, rawContent);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Comment side-effects (mentions/notifications) failed for comment {CommentId}", comment.Id);
            }
        }
```

- [ ] **Step 4: Run → PASS** — `dotnet test Backend/SorobanSecurityPortalApi.Tests --filter "FullyQualifiedName~CommentServiceTests"` → all pass (prior + 3 new). The existing `AddComment_Stores_Mentions_From_Content` test still passes (ReplaceCommentMentions is still called, now inside the helper). Build (0 errors).

- [ ] **Step 5: Full suite + commit**

`dotnet test Backend/SorobanSecurityPortalApi.Tests` → 0 failures, total **295** (292 + 3 new).

```bash
git add Backend/SorobanSecurityPortalApi/Services/ControllersServices/CommentService.cs Backend/SorobanSecurityPortalApi.Tests/Services/CommentServiceTests.cs
git commit -m "feat(comments): fire reply/mention notifications on create; make comment side-effects non-fatal (audit #1)"
```
(Append `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>` trailer.)

---

## Self-Review

**Spec coverage:** reply notification to the replied-to author (#61) + mention notifications (#75) now fire on comment create via `NotifyForNewComment`; audit #1 fixed — mention storage + notification creation are wrapped non-fatal so a failure can't fail/duplicate the comment; `UpdateComment` re-indexes mentions non-fatally without re-notifying (no edit spam).

**Placeholder scan:** none.

**Type consistency:** `INotificationService.NotifyForNewComment(int, int?, IReadOnlyList<int>, int, EntityType, int, string)` matches the existing service signature (PR5) and the `RunCommentSideEffects` call; `_mentionProcessor.ReplaceCommentMentions` returns `List<int>` (assignable to `IReadOnlyList<int>`); `CommentService` ctor gains `INotificationService` + `ILogger<CommentService>` (last two params) with `CommentServiceTests.Build()` updated; both auto/explicit-registered already (`INotificationService` explicit in Startup; `ILogger<>` from the framework).

## Carry-forwards (PR5c)
- SignalR hub `/hubs/notifications` + Redis backplane + JWT-on-socket + `IRealtimePublisher` (over `IHubContext`, default SignalR `IUserIdProvider` uses the `NameIdentifier`=login claim; the publisher maps `RecipientUserId`→login name via `ILoginProcessor`); `NotificationService.NotifyForNewComment` pushes live after persisting.
- Suppress notifications about hidden/deleted comments (and consider rejecting replies to hidden parents).
- PR8: bell + `/mentions` inbox (`Type == Mention`) + deep-link from `EntityType`/`EntityId`/`CommentId`.

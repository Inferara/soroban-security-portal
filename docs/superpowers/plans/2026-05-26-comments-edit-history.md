# Comment Editing + History — Implementation Plan (PR2b)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a comment's author edit it within 30 minutes of posting, keeping an edit-history trail; let moderators view that history. Completes CRUD (Update).

**Architecture:** `CommentsController.PUT/GET history → ICommentService.UpdateComment/GetEditHistory → ICommentProcessor.UpdateContent → Db`. Re-runs the content filter on edit; appends `{EditedAt, PreviousContent}` to the existing `edit_history` jsonb column; sets `IsEdited`/`UpdatedAt`. Mirrors PR2 conventions.

**Tech Stack:** ASP.NET Core, EF Core, AutoMapper, `System.Text.Json` for the history array, xUnit + Moq + FluentAssertions. Branch `feature/comments-discussion`. Baseline: 238 tests green.

**Scope:** PUT edit (owner, ≤30 min, re-filtered, history appended) + GET edit-history (moderator/admin). **Excludes:** the frontend countdown/disable UI (#64 frontend → PR7); voting/mentions/notifications.

---

### Task 1: Edit DTOs + CommentProcessor.UpdateContent (TDD)

**Files:**
- Modify: `Backend/SorobanSecurityPortalApi/Models/ViewModels/CommentViewModel.cs`
- Modify: `Backend/SorobanSecurityPortalApi/Data/Processors/CommentProcessor.cs`
- Modify: `Backend/SorobanSecurityPortalApi.Tests/Data/CommentProcessorTests.cs`

- [ ] **Step 1: Add the DTOs**

Append to `CommentViewModel.cs` (inside the `...ViewModels` namespace, after `CreateCommentRequest`):

```csharp
    public class UpdateCommentRequest
    {
        public string Content { get; set; } = string.Empty;
    }

    // One entry in a comment's edit trail (stored as a JSON array in comment.edit_history).
    public class CommentEditHistoryEntry
    {
        public DateTime EditedAt { get; set; }
        public string PreviousContent { get; set; } = string.Empty;
    }
```

- [ ] **Step 2: Write the failing processor test**

Append to `CommentProcessorTests.cs` (reuse the existing `BuildFactory(out dbMock)` helper which exposes `db.Comment` + `SaveChangesAsync`):

```csharp
        [Fact]
        public async Task UpdateContent_Updates_Fields_And_Marks_Edited()
        {
            var existing = new CommentModel { Id = 7, Content = "old", ContentHtml = "<p>old</p>", EditHistory = "[]", IsEdited = false };
            var processor = new CommentProcessor(BuildFactory(new List<CommentModel> { existing }, out var dbMock).Object);

            var updated = await processor.UpdateContent(7, "new", "<p>new</p>", "[{\"EditedAt\":\"2026-01-01T00:00:00Z\",\"PreviousContent\":\"old\"}]");

            updated.Should().NotBeNull();
            updated!.Content.Should().Be("new");
            updated.ContentHtml.Should().Be("<p>new</p>");
            updated.IsEdited.Should().BeTrue();
            updated.UpdatedAt.Should().NotBeNull();
            updated.EditHistory.Should().Contain("PreviousContent");
            dbMock.Verify(d => d.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task UpdateContent_Returns_Null_For_Missing()
        {
            var processor = new CommentProcessor(BuildFactory(new List<CommentModel>(), out _).Object);
            (await processor.UpdateContent(999, "x", "<p>x</p>", "[]")).Should().BeNull();
        }
```

- [ ] **Step 3: Run → expect FAIL**

Run: `dotnet test Backend/SorobanSecurityPortalApi.Tests --filter "FullyQualifiedName~CommentProcessorTests"`
Expected: compile failure — `UpdateContent` not defined.

- [ ] **Step 4: Implement `UpdateContent`**

Add to `CommentProcessor.cs` (class) and `ICommentProcessor` (interface):

```csharp
        public async Task<CommentModel?> UpdateContent(int id, string content, string contentHtml, string editHistoryJson)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var c = await db.Comment.FirstOrDefaultAsync(x => x.Id == id);
            if (c == null) return null;
            c.Content = content;
            c.ContentHtml = contentHtml;
            c.EditHistory = editHistoryJson;
            c.IsEdited = true;
            c.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
            return c;
        }
```

Interface signature:

```csharp
        Task<CommentModel?> UpdateContent(int id, string content, string contentHtml, string editHistoryJson);
```

- [ ] **Step 5: Run → expect PASS**

Run: `dotnet test Backend/SorobanSecurityPortalApi.Tests --filter "FullyQualifiedName~CommentProcessorTests"`
Expected: all pass (14 prior + 2 new = 16).

- [ ] **Step 6: Build + commit**

Run: `dotnet build Backend/SorobanSecurityPortalApi/SorobanSecurityPortalApi.csproj -v quiet --nologo` → 0 errors.

```bash
git add Backend/SorobanSecurityPortalApi/Models/ViewModels/CommentViewModel.cs Backend/SorobanSecurityPortalApi/Data/Processors/CommentProcessor.cs Backend/SorobanSecurityPortalApi.Tests/Data/CommentProcessorTests.cs
git commit -m "feat(comments): add edit DTOs + CommentProcessor.UpdateContent"
```
(Append `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>` to every commit.)

---

### Task 2: CommentService.UpdateComment + GetEditHistory (TDD)

**Files:**
- Modify: `Backend/SorobanSecurityPortalApi/Services/ControllersServices/CommentService.cs`
- Modify: `Backend/SorobanSecurityPortalApi.Tests/Services/CommentServiceTests.cs`

- [ ] **Step 1: Write the failing tests**

Append to `CommentServiceTests.cs` (reuse `_processor`, `_filter`, `_userContext`, `_mapper`, `_cache`, `Build()`, `AllowFilter()`):

```csharp
        [Fact]
        public async Task UpdateComment_Rejects_When_Not_Authenticated()
        {
            _userContext.Setup(u => u.GetLoginIdAsync()).ReturnsAsync(0);
            await Build().Invoking(s => s.UpdateComment(7, "new"))
                .Should().ThrowAsync<UnauthorizedAccessException>();
        }

        [Fact]
        public async Task UpdateComment_Rejects_NonOwner()
        {
            _userContext.Setup(u => u.GetLoginIdAsync()).ReturnsAsync(5);
            _processor.Setup(p => p.Get(7)).ReturnsAsync(new CommentModel { Id = 7, AuthorId = 6, CreatedAt = DateTime.UtcNow });
            await Build().Invoking(s => s.UpdateComment(7, "new"))
                .Should().ThrowAsync<UnauthorizedAccessException>();
        }

        [Fact]
        public async Task UpdateComment_Rejects_After_Edit_Window()
        {
            _userContext.Setup(u => u.GetLoginIdAsync()).ReturnsAsync(5);
            _processor.Setup(p => p.Get(7)).ReturnsAsync(new CommentModel { Id = 7, AuthorId = 5, CreatedAt = DateTime.UtcNow.AddMinutes(-31) });
            await Build().Invoking(s => s.UpdateComment(7, "new"))
                .Should().ThrowAsync<InvalidOperationException>();
        }

        [Fact]
        public async Task UpdateComment_Rejects_Blocked_Content()
        {
            _userContext.Setup(u => u.GetLoginIdAsync()).ReturnsAsync(5);
            _processor.Setup(p => p.Get(7)).ReturnsAsync(new CommentModel { Id = 7, AuthorId = 5, CreatedAt = DateTime.UtcNow, Content = "old", EditHistory = "[]" });
            _filter.Setup(f => f.CheckRateLimitAsync(5)).ReturnsAsync(true);
            _filter.Setup(f => f.FilterContentAsync("bad", 5)).ReturnsAsync(new ContentFilterResult { IsBlocked = true, Warnings = new List<string> { "nope" } });
            await Build().Invoking(s => s.UpdateComment(7, "bad"))
                .Should().ThrowAsync<InvalidOperationException>();
        }

        [Fact]
        public async Task UpdateComment_Appends_History_And_Sets_Sanitized_Html()
        {
            _userContext.Setup(u => u.GetLoginIdAsync()).ReturnsAsync(5);
            _processor.Setup(p => p.Get(7)).ReturnsAsync(new CommentModel { Id = 7, AuthorId = 5, CreatedAt = DateTime.UtcNow, Content = "old text", EditHistory = "[]" });
            _filter.Setup(f => f.CheckRateLimitAsync(5)).ReturnsAsync(true);
            _filter.Setup(f => f.FilterContentAsync("new text", 5)).ReturnsAsync(new ContentFilterResult { IsBlocked = false, SanitizedContent = "<p>new text</p>" });
            _processor.Setup(p => p.GetAuthorNames(It.IsAny<List<int>>())).ReturnsAsync(new Dictionary<int, string> { { 5, "Alice" } });
            string? historyJson = null;
            _processor.Setup(p => p.UpdateContent(7, "new text", "<p>new text</p>", It.IsAny<string>()))
                .ReturnsAsync((int _, string c, string h, string hist) =>
                {
                    historyJson = hist;
                    return new CommentModel { Id = 7, AuthorId = 5, Content = c, ContentHtml = h, IsEdited = true, EditHistory = hist };
                });

            var vm = await Build().UpdateComment(7, "new text");

            vm.AuthorName.Should().Be("Alice");
            vm.IsEdited.Should().BeTrue();
            historyJson.Should().Contain("old text"); // previous content captured in the trail
        }

        [Fact]
        public async Task GetEditHistory_Returns_Parsed_Entries()
        {
            _processor.Setup(p => p.Get(7)).ReturnsAsync(new CommentModel
            {
                Id = 7,
                EditHistory = "[{\"EditedAt\":\"2026-01-01T00:00:00Z\",\"PreviousContent\":\"v1\"}]"
            });

            var history = await Build().GetEditHistory(7);

            history.Should().ContainSingle();
            history[0].PreviousContent.Should().Be("v1");
        }

        [Fact]
        public async Task GetEditHistory_Throws_For_Missing()
        {
            _processor.Setup(p => p.Get(7)).ReturnsAsync((CommentModel?)null);
            await Build().Invoking(s => s.GetEditHistory(7)).Should().ThrowAsync<KeyNotFoundException>();
        }
```

- [ ] **Step 2: Run → expect FAIL**

Run: `dotnet test Backend/SorobanSecurityPortalApi.Tests --filter "FullyQualifiedName~CommentServiceTests"`
Expected: compile failure — `UpdateComment`/`GetEditHistory` not defined.

- [ ] **Step 3: Implement the service methods**

In `CommentService.cs`: add `using System.Text.Json;` at the top (it was removed in PR2 — now genuinely needed). Add the edit-window constant and methods, and the two signatures to `ICommentService`:

```csharp
        // Interface (add):
        Task<CommentViewModel> UpdateComment(int id, string content);
        Task<List<CommentEditHistoryEntry>> GetEditHistory(int id);
```

```csharp
        // Class (add):
        private const int EditWindowMinutes = 30;

        public async Task<CommentViewModel> UpdateComment(int id, string content)
        {
            var userId = await _userContext.GetLoginIdAsync();
            if (userId == 0) throw new UnauthorizedAccessException("User not logged in.");

            var comment = await _processor.Get(id);
            if (comment == null) throw new KeyNotFoundException($"Comment with id {id} not found.");
            if (comment.AuthorId != userId)
                throw new UnauthorizedAccessException("You can only edit your own comments.");
            if ((DateTime.UtcNow - comment.CreatedAt).TotalMinutes > EditWindowMinutes)
                throw new InvalidOperationException("The edit window for this comment has expired.");

            if (!await _contentFilter.CheckRateLimitAsync(userId))
                throw new InvalidOperationException("Rate limit exceeded. Please wait a moment before submitting again.");
            var filterResult = await _contentFilter.FilterContentAsync(content, userId);
            if (filterResult.IsBlocked)
                throw new InvalidOperationException($"Comment blocked: {string.Join("; ", filterResult.Warnings)}");

            var history = ParseHistory(comment.EditHistory);
            history.Add(new CommentEditHistoryEntry { EditedAt = DateTime.UtcNow, PreviousContent = comment.Content });

            var updated = await _processor.UpdateContent(
                id, content, filterResult.SanitizedContent ?? string.Empty, JsonSerializer.Serialize(history));

            var names = await _processor.GetAuthorNames(new List<int> { userId });
            var vm = _mapper.Map<CommentViewModel>(updated!);
            vm.AuthorName = names.TryGetValue(userId, out var nm) && !string.IsNullOrWhiteSpace(nm) ? nm : "Anonymous";
            return vm;
        }

        public async Task<List<CommentEditHistoryEntry>> GetEditHistory(int id)
        {
            var comment = await _processor.Get(id);
            if (comment == null) throw new KeyNotFoundException($"Comment with id {id} not found.");
            return ParseHistory(comment.EditHistory);
        }

        private static List<CommentEditHistoryEntry> ParseHistory(string? json)
            => JsonSerializer.Deserialize<List<CommentEditHistoryEntry>>(
                   string.IsNullOrWhiteSpace(json) ? "[]" : json) ?? new List<CommentEditHistoryEntry>();
```

- [ ] **Step 4: Run → expect PASS**

Run: `dotnet test Backend/SorobanSecurityPortalApi.Tests --filter "FullyQualifiedName~CommentServiceTests"`
Expected: all pass (13 prior + 7 new = 20).

- [ ] **Step 5: Build + commit**

Run: `dotnet build Backend/SorobanSecurityPortalApi/SorobanSecurityPortalApi.csproj -v quiet --nologo` → 0 errors.

```bash
git add Backend/SorobanSecurityPortalApi/Services/ControllersServices/CommentService.cs Backend/SorobanSecurityPortalApi.Tests/Services/CommentServiceTests.cs
git commit -m "feat(comments): add CommentService edit + edit-history with tests"
```

---

### Task 3: CommentsController PUT + history endpoint + full suite

**Files:**
- Modify: `Backend/SorobanSecurityPortalApi/Controllers/CommentsController.cs`

- [ ] **Step 1: Add the endpoints**

Open `Controllers/ModerationController.cs` and copy its EXACT `using` for the role attribute (`using SorobanSecurityPortalApi.Authorization.Attributes;` plus whatever namespace `Role` resolves from — replicate ModerationController's usings so `[RoleAuthorize(Role.Admin, Role.Moderator)]` compiles identically). Add those usings to `CommentsController.cs`, then add these two actions inside the controller class:

```csharp
        [HttpPut("{id}")]
        [Authorize]
        public async Task<IActionResult> Update(int id, [FromBody] UpdateCommentRequest request)
        {
            if (id <= 0) return BadRequest("Comment ID must be a positive integer.");
            if (request == null || string.IsNullOrWhiteSpace(request.Content)) return BadRequest("Content must not be empty.");
            if (request.Content.Length > 10000) return BadRequest("Content must not exceed 10000 characters.");

            try
            {
                var result = await _commentService.UpdateComment(id, request.Content);
                return Ok(result);
            }
            catch (System.UnauthorizedAccessException) { return Forbid(); }
            catch (KeyNotFoundException) { return NotFound($"Comment with id {id} not found."); }
            catch (InvalidOperationException ex) { return BadRequest(ex.Message); }
        }

        [HttpGet("{id}/history")]
        [RoleAuthorize(Role.Admin, Role.Moderator)]
        public async Task<IActionResult> History(int id)
        {
            if (id <= 0) return BadRequest("Comment ID must be a positive integer.");
            try
            {
                var result = await _commentService.GetEditHistory(id);
                return Ok(result);
            }
            catch (KeyNotFoundException) { return NotFound($"Comment with id {id} not found."); }
        }
```

- [ ] **Step 2: Build**

Run: `dotnet build Backend/SorobanSecurityPortalApi/SorobanSecurityPortalApi.csproj -v quiet --nologo`
Expected: 0 errors. (If `Role`/`RoleAuthorize` don't resolve, fix the usings to exactly match ModerationController.)

- [ ] **Step 3: Full suite (no regressions)**

Run: `dotnet test Backend/SorobanSecurityPortalApi.Tests`
Expected: 0 failures. Total = 238 + 2 (processor) + 7 (service) = **247**.

- [ ] **Step 4: Commit**

```bash
git add Backend/SorobanSecurityPortalApi/Controllers/CommentsController.cs
git commit -m "feat(comments): add PUT edit + moderator edit-history endpoints"
```

---

## Self-Review

**Spec coverage (#64):** 30-min edit window (Task 2 `EditWindowMinutes`); "Edited" indicator (already in DTO via `IsEdited`/`UpdatedAt`, set by `UpdateContent`); edit history in jsonb (Task 1/2 append + store); moderators view history (Task 2 `GetEditHistory` + Task 3 `[RoleAuthorize(Role.Admin, Role.Moderator)]`); re-run content filter on edit (Task 2 `FilterContentAsync`); disable-after-expiry server side (Task 2 window check → 400). Frontend countdown/disable UI is deferred (#64 frontend → PR7).

**Placeholder scan:** none — concrete code + exact commands throughout.

**Type consistency:** `ICommentProcessor.UpdateContent(int,string,string,string)` matches the service call + the test setups; `ICommentService.UpdateComment(int,string)`/`GetEditHistory(int)` match the controller calls + tests; `CommentEditHistoryEntry { EditedAt, PreviousContent }` serialized & parsed with the same property names; `UpdateCommentRequest.Content` matches the controller body. `[RoleAuthorize(Role.Admin, Role.Moderator)]` mirrors ModerationController exactly.

## Next plans
PR3 voting (#80, fills UpvoteCount/DownvoteCount + currentUserVote). PR4 mentions. PR5 SignalR + notifications. PR6-8 frontend.

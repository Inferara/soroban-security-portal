# Comment @Mentions (parse + store) — Implementation Plan (PR4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a comment is created or edited, parse `@username` mentions from its text, resolve them to user IDs (stored by ID so renames don't break), and persist them with positions in a `mention` table — ready for notification delivery (PR5) and link rendering (PR7).

**Architecture:** A pure `MentionParser` (regex, position-aware, ignores email-style `foo@bar`), a `MentionProcessor.ReplaceCommentMentions(commentId, content)` (parse → resolve usernames against `Login` → replace the comment's mention rows in one `SaveChanges`, returning the distinct mentioned user IDs), wired into `CommentService.AddComment`/`UpdateComment` after the comment is saved. Mirrors existing processor/service conventions.

**Tech Stack:** ASP.NET Core, EF Core (PostgreSQL), xUnit + Moq + FluentAssertions. Branch `feature/comments-discussion`. Baseline: 271 tests green.

**Scope:** `mention` table + parser + processor + create/edit wiring. **Excludes:** user-search autocomplete endpoint → **PR7** (feeds the autocomplete UI); notification generation for mentioned users → **PR5** (consumes `ReplaceCommentMentions`'s returned IDs); link rendering → PR7.

**Design note — username resolution is exact-match (case-sensitive).** Mentions in practice come from the PR7 autocomplete, which supplies the exact username, so exact match is sufficient and translates identically in EF (real PG `IN`) and the in-memory test mocks. Case-insensitive matching can be a later refinement.

---

### Task 1: MentionModel + migration

**Files:**
- Create: `Backend/SorobanSecurityPortalApi/Models/DbModels/MentionModel.cs`
- Modify: `Backend/SorobanSecurityPortalApi/Common/Data/Db.cs` (DbSet + indexes)
- Modify: `Backend/SorobanSecurityPortalApi/appsettings.json` (ProductVersion → 1.22)
- Create (via EF CLI): `Migrations/<ts>_AddMentions.cs` (+ Designer + snapshot)

- [ ] **Step 1: Model**

`MentionModel.cs`:

```csharp
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SorobanSecurityPortalApi.Models.DbModels
{
    [Table("mention")]
    public class MentionModel
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int CommentId { get; set; }

        // Stored by user id (not username) so username changes don't break mentions.
        [Required]
        public int MentionedUserId { get; set; }

        // Character offsets of the @token within the comment's raw content (for highlighting).
        [Required]
        public int StartPos { get; set; }

        [Required]
        public int EndPos { get; set; }
    }
}
```

- [ ] **Step 2: DbSet + indexes**

In `Db.cs`, after the `Vote` DbSet:

```csharp
        public virtual DbSet<MentionModel> Mention { get; set; }
```

In `OnModelCreating` (param `builder`), after the vote index block:

```csharp
            builder.Entity<MentionModel>()
                .HasIndex(m => m.CommentId);
            builder.Entity<MentionModel>()
                .HasIndex(m => m.MentionedUserId);
```

- [ ] **Step 3: ProductVersion bump** — in `appsettings.json`, `"ProductVersion": "1.21"` → `"1.22"`.

- [ ] **Step 4: Generate migration**

```bash
cd Backend/SorobanSecurityPortalApi
dotnet ef migrations add AddMentions --context Db
cd ../..
```
Verify `<ts>_AddMentions.cs` creates table `mention` (snake_case `comment_id`, `mentioned_user_id`, `start_pos`, `end_pos`) + `ix_mention_comment_id` + `ix_mention_mentioned_user_id`, and `DbModelSnapshot.cs` updated. If snapshot didn't change → delete + regenerate (never hand-write).

- [ ] **Step 5: Build + commit**

`dotnet build Backend/SorobanSecurityPortalApi/SorobanSecurityPortalApi.csproj -v quiet --nologo` → 0 errors.

```bash
git add Backend/SorobanSecurityPortalApi/Models/DbModels/MentionModel.cs Backend/SorobanSecurityPortalApi/Common/Data/Db.cs Backend/SorobanSecurityPortalApi/appsettings.json Backend/SorobanSecurityPortalApi/Migrations/
git commit -m "feat(comments): add mention table + migration; bump ProductVersion to 1.22"
```
(Append `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>` to every commit.)

---

### Task 2: MentionParser + MentionProcessor (TDD)

**Files:**
- Create: `Backend/SorobanSecurityPortalApi/Common/MentionParser.cs`
- Create: `Backend/SorobanSecurityPortalApi/Data/Processors/MentionProcessor.cs`
- Create: `Backend/SorobanSecurityPortalApi.Tests/Common/MentionParserTests.cs`
- Create: `Backend/SorobanSecurityPortalApi.Tests/Data/MentionProcessorTests.cs`

- [ ] **Step 1: Write the failing parser tests**

`MentionParserTests.cs`:

```csharp
using System.Linq;
using FluentAssertions;
using SorobanSecurityPortalApi.Common;
using Xunit;

namespace SorobanSecurityPortalApi.Tests.Common
{
    public class MentionParserTests
    {
        [Fact]
        public void Parses_Single_Mention_With_Position()
        {
            var tokens = MentionParser.Parse("hello @alice!");
            tokens.Should().ContainSingle();
            tokens[0].Username.Should().Be("alice");
            tokens[0].StartPos.Should().Be(6);      // index of '@'
            tokens[0].EndPos.Should().Be(12);        // exclusive end of "@alice"
        }

        [Fact]
        public void Parses_Multiple_And_Mention_At_Start()
        {
            var tokens = MentionParser.Parse("@bob and @carol-1 too");
            tokens.Select(t => t.Username).Should().Equal("bob", "carol-1");
        }

        [Fact]
        public void Ignores_Email_Like_Text()
        {
            // '@' preceded by a non-space char is not a mention.
            MentionParser.Parse("mail me at foo@bar.com").Should().BeEmpty();
        }

        [Fact]
        public void Matches_Mention_After_Newline()
        {
            MentionParser.Parse("line1\n@dave").Select(t => t.Username).Should().Equal("dave");
        }

        [Fact]
        public void Empty_Or_Null_Yields_None()
        {
            MentionParser.Parse("").Should().BeEmpty();
            MentionParser.Parse(null!).Should().BeEmpty();
        }
    }
}
```

- [ ] **Step 2: Run → FAIL** (`--filter "FullyQualifiedName~MentionParserTests"`).

- [ ] **Step 3: Implement `MentionParser`**

`MentionParser.cs`:

```csharp
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;

namespace SorobanSecurityPortalApi.Common
{
    public record MentionToken(string Username, int StartPos, int EndPos);

    public static class MentionParser
    {
        // @username, where '@' is at the start of the string or preceded by whitespace
        // (so emails like foo@bar are not matched). Username = letters/digits/_/./-.
        private static readonly Regex Rx = new(@"(?<=^|\s)@([A-Za-z0-9_.\-]+)", RegexOptions.Compiled);

        public static List<MentionToken> Parse(string content)
        {
            if (string.IsNullOrEmpty(content)) return new List<MentionToken>();
            return Rx.Matches(content)
                .Select(m => new MentionToken(m.Groups[1].Value, m.Index, m.Index + m.Length))
                .ToList();
        }
    }
}
```

- [ ] **Step 4: Run → PASS** (5 parser tests).

- [ ] **Step 5: Write the failing processor tests**

`MentionProcessorTests.cs` (uses `Mock<Db>` + `TestAsyncQueryProvider`/`TestAsyncEnumerator` from `SorobanSecurityPortalApi.Tests.Services`; `Db.Login` is NOT virtual → direct-assign; `Db.Mention` IS virtual):

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
    public class MentionProcessorTests
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
            m.Setup(d => d.RemoveRange(It.IsAny<IEnumerable<T>>())).Callback<IEnumerable<T>>(items => { foreach (var i in items.ToList()) src.Remove(i); });
            return m;
        }

        private static Mock<IDbContextFactory<Db>> Factory(List<MentionModel> mentions, List<LoginModel> logins)
        {
            var db = new Mock<Db>(
                new Mock<IDbQuery>().Object,
                new Mock<Microsoft.Extensions.Logging.ILogger<Db>>().Object,
                new Mock<IDataSourceProvider>().Object) { CallBase = true };
            db.Setup(d => d.Mention).Returns(Set(mentions).Object);
            db.Object.Login = Set(logins).Object; // Login is not virtual
            db.Setup(d => d.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
            var f = new Mock<IDbContextFactory<Db>>();
            f.Setup(x => x.CreateDbContextAsync(It.IsAny<CancellationToken>())).ReturnsAsync(db.Object);
            return f;
        }

        [Fact]
        public async Task Resolves_Known_Usernames_And_Stores_Mentions()
        {
            var mentions = new List<MentionModel>();
            var logins = new List<LoginModel> { new() { LoginId = 11, Login = "alice" }, new() { LoginId = 22, Login = "bob" } };
            var proc = new MentionProcessor(Factory(mentions, logins).Object);

            var ids = await proc.ReplaceCommentMentions(commentId: 5, "hi @alice and @bob and @ghost");

            ids.Should().BeEquivalentTo(new[] { 11, 22 });           // @ghost unresolved → skipped
            mentions.Should().HaveCount(2);
            mentions.Select(m => m.MentionedUserId).Should().BeEquivalentTo(new[] { 11, 22 });
            mentions.All(m => m.CommentId == 5).Should().BeTrue();
        }

        [Fact]
        public async Task Replaces_Existing_Mentions_For_The_Comment()
        {
            var mentions = new List<MentionModel> { new() { Id = 1, CommentId = 5, MentionedUserId = 99, StartPos = 0, EndPos = 3 } };
            var logins = new List<LoginModel> { new() { LoginId = 11, Login = "alice" } };
            var proc = new MentionProcessor(Factory(mentions, logins).Object);

            var ids = await proc.ReplaceCommentMentions(5, "now only @alice");

            ids.Should().Equal(11);
            mentions.Should().ContainSingle();
            mentions[0].MentionedUserId.Should().Be(11); // old (99) removed, new (11) added
        }

        [Fact]
        public async Task No_Mentions_Clears_Existing_And_Returns_Empty()
        {
            var mentions = new List<MentionModel> { new() { Id = 1, CommentId = 5, MentionedUserId = 99 } };
            var proc = new MentionProcessor(Factory(mentions, new List<LoginModel>()).Object);

            var ids = await proc.ReplaceCommentMentions(5, "no mentions here");

            ids.Should().BeEmpty();
            mentions.Should().BeEmpty();
        }
    }
}
```

- [ ] **Step 6: Run → FAIL** (`--filter "FullyQualifiedName~MentionProcessorTests"`).

- [ ] **Step 7: Implement `MentionProcessor`**

`MentionProcessor.cs`:

```csharp
using System;
using Microsoft.EntityFrameworkCore;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Models.DbModels;

namespace SorobanSecurityPortalApi.Data.Processors
{
    public class MentionProcessor : IMentionProcessor
    {
        private readonly IDbContextFactory<Db> _dbFactory;
        public MentionProcessor(IDbContextFactory<Db> dbFactory) => _dbFactory = dbFactory;

        public async Task<List<int>> ReplaceCommentMentions(int commentId, string content)
        {
            var tokens = MentionParser.Parse(content);
            await using var db = await _dbFactory.CreateDbContextAsync();

            // Replace strategy: clear this comment's existing mentions, then re-insert.
            var existing = await db.Mention.Where(m => m.CommentId == commentId).ToListAsync();
            if (existing.Count > 0) db.Mention.RemoveRange(existing);

            var mentionedIds = new List<int>();
            if (tokens.Count > 0)
            {
                var usernames = tokens.Select(t => t.Username).Distinct().ToList();
                var resolved = await db.Login.AsNoTracking()
                    .Where(l => usernames.Contains(l.Login))
                    .Select(l => new { l.LoginId, l.Login })
                    .ToListAsync();
                var idByName = resolved.ToDictionary(r => r.Login, r => r.LoginId);

                foreach (var t in tokens)
                {
                    if (!idByName.TryGetValue(t.Username, out var uid)) continue;
                    db.Mention.Add(new MentionModel
                    {
                        CommentId = commentId,
                        MentionedUserId = uid,
                        StartPos = t.StartPos,
                        EndPos = t.EndPos
                    });
                    if (!mentionedIds.Contains(uid)) mentionedIds.Add(uid);
                }
            }

            await db.SaveChangesAsync();
            return mentionedIds;
        }
    }

    public interface IMentionProcessor
    {
        // Re-parses the content, resolves @usernames against the Login table, replaces the
        // comment's mention rows, and returns the distinct mentioned user ids (for notifications).
        Task<List<int>> ReplaceCommentMentions(int commentId, string content);
    }
}
```

- [ ] **Step 8: Run → PASS** (3 processor tests). Build (0 errors).

- [ ] **Step 9: Commit**

```bash
git add Backend/SorobanSecurityPortalApi/Common/MentionParser.cs Backend/SorobanSecurityPortalApi/Data/Processors/MentionProcessor.cs Backend/SorobanSecurityPortalApi.Tests/Common/MentionParserTests.cs Backend/SorobanSecurityPortalApi.Tests/Data/MentionProcessorTests.cs
git commit -m "feat(comments): add MentionParser + MentionProcessor (parse, resolve, store) with tests"
```

---

### Task 3: Wire mention storage into CommentService (TDD)

**Files:**
- Modify: `Backend/SorobanSecurityPortalApi/Services/ControllersServices/CommentService.cs` (inject `IMentionProcessor`; call it in `AddComment` + `UpdateComment`)
- Modify: `Backend/SorobanSecurityPortalApi.Tests/Services/CommentServiceTests.cs` (add the mock dependency + a default setup; add 1 test)

- [ ] **Step 1: Write the failing test**

In `CommentServiceTests.cs`, add a `Mock<IMentionProcessor>` field and a test asserting mentions are stored on create. Add:

```csharp
        private readonly Mock<IMentionProcessor> _mentionProcessor = new();
```

And in the test class, a test:

```csharp
        [Fact]
        public async Task AddComment_Stores_Mentions_From_Content()
        {
            _userContext.Setup(u => u.GetLoginIdAsync()).ReturnsAsync(5);
            _processor.Setup(p => p.EntityExists(EntityType.Report, 9)).ReturnsAsync(true);
            AllowFilter();
            _processor.Setup(p => p.GetAuthorNames(It.IsAny<List<int>>())).ReturnsAsync(new Dictionary<int, string> { { 5, "Alice" } });
            _processor.Setup(p => p.Add(It.IsAny<CommentModel>())).ReturnsAsync((CommentModel c) => { c.Id = 100; return c; });

            await Build().AddComment(new CreateCommentRequest { EntityType = EntityType.Report, EntityId = 9, Content = "hey @bob" });

            _mentionProcessor.Verify(m => m.ReplaceCommentMentions(100, "hey @bob"), Times.Once);
        }
```

- [ ] **Step 2: Update `Build()` to inject the mock + default its return**

In the `Build()` helper, pass `_mentionProcessor.Object` as the new last `CommentService` ctor argument. Add a default setup so the existing AddComment/UpdateComment tests don't NRE on the awaited call — put this in the `Build()` method (or a constructor) before `new CommentService(...)`:

```csharp
            _mentionProcessor.Setup(m => m.ReplaceCommentMentions(It.IsAny<int>(), It.IsAny<string>()))
                .ReturnsAsync(new List<int>());
```

- [ ] **Step 3: Run → FAIL** (`CommentService` ctor arity mismatch / mention not called).

- [ ] **Step 4: Implement** — in `CommentService.cs`:

Add `using SorobanSecurityPortalApi.Data.Processors;` if not present (it is). Add `IMentionProcessor` as the LAST constructor parameter + a `_mentionProcessor` field. Then:

- In `AddComment`, after `var saved = await _processor.Add(comment);` and before/around the cache invalidation, add:
```csharp
            await _mentionProcessor.ReplaceCommentMentions(saved.Id, request.Content);
```
- In `UpdateComment`, after `if (updated == null) throw ...;` add:
```csharp
            await _mentionProcessor.ReplaceCommentMentions(id, content);
```
(The returned ids are unused for now — PR5 will use them to send notifications.)

- [ ] **Step 5: Run → PASS**

`dotnet test Backend/SorobanSecurityPortalApi.Tests --filter "FullyQualifiedName~CommentServiceTests"` → all pass (prior + 1 new). Build (0 errors).

- [ ] **Step 6: Full suite + commit**

`dotnet test Backend/SorobanSecurityPortalApi.Tests` → 0 failures, total = 271 + 5 (parser) + 3 (processor) + 1 (service) = **280**.

```bash
git add Backend/SorobanSecurityPortalApi/Services/ControllersServices/CommentService.cs Backend/SorobanSecurityPortalApi.Tests/Services/CommentServiceTests.cs
git commit -m "feat(comments): parse + store @mentions on comment create/edit"
```

---

## Self-Review

**Spec coverage (#75 backend, parse/store slice):** detect `@`-prefix + parse (Task 2 `MentionParser`, position-aware, email-safe); store in `MentionModel` by **user id** with positions (Task 1 model + Task 2 processor); parse on submit AND edit (Task 3 wiring); handle unknown usernames (skipped) and renames (id-based). **Deferred:** autocomplete search endpoint → PR7; notification generation → PR5 (consumes the returned ids); link rendering → PR7.

**Placeholder scan:** none — concrete code + commands.

**Type consistency:** `MentionParser.Parse → List<MentionToken{Username,StartPos,EndPos}>` consumed by `MentionProcessor`; `IMentionProcessor.ReplaceCommentMentions(int,string)→Task<List<int>>` matches the service calls + tests; `MentionModel` columns match the parser's positions; `CommentService` ctor gains `IMentionProcessor` (last param) with `CommentServiceTests.Build()` updated + a default mock setup so prior tests keep passing.

## Carry-forwards
- **PR5** uses `ReplaceCommentMentions`'s returned ids to create `Mention`-type notifications + deliver via SignalR; the `mention` table's `MentionedUserId` index supports a future "mentions of me" inbox (#76).
- **PR7** adds the `@` autocomplete (needs a `GET /users/search?q=` endpoint — build it there) and renders stored mentions as profile links using the positions.
- Username resolution is exact-match; revisit case-insensitivity if needed.

## Next plans
PR5 SignalR + notifications backbone (#56, #65-69) — wires mention + reply notifications. PR6-8 frontend.

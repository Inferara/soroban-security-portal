# Notifications Backbone — Implementation Plan (PR5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A persisted notifications subsystem — a `notification` table, processor, service, and REST API — plus the business logic that builds reply (#61) and `@mention` (#75) notifications (self-filtered, deduped, mention-capped). After this, notifications can be created, listed, counted (unread), and marked read; **real-time SignalR delivery and the wiring into comment creation are PR5b.**

**Architecture:** `NotificationsController → INotificationService → INotificationProcessor → Db`, mirroring the comment/vote stack. `INotificationService.NotifyForNewComment(...)` builds the right `NotificationModel`s (reply + mentions) and persists them via the processor; PR5b will add the real-time push and call this from `CommentService`.

**Tech Stack:** ASP.NET Core, EF Core (PostgreSQL), xUnit + Moq + FluentAssertions. Branch `feature/comments-discussion`. Baseline: 280 tests green.

**Scope:** notification table + processor + service (CRUD + `NotifyForNewComment` builder) + controller. **Excludes (PR5b):** SignalR hub / Redis backplane / JWT-on-socket / real-time push; wiring `NotifyForNewComment` into `CommentService` (and the #1 non-fatal-side-effects fix); self-mention already handled here by filtering the actor.

---

### Task 1: NotificationModel + migration

**Files:**
- Create: `Backend/SorobanSecurityPortalApi/Models/DbModels/NotificationModel.cs`
- Modify: `Backend/SorobanSecurityPortalApi/Common/Data/Db.cs` (DbSet + indexes)
- Modify: `Backend/SorobanSecurityPortalApi/appsettings.json` (ProductVersion → 1.23)
- Create (via EF CLI): `Migrations/<ts>_AddNotifications.cs` (+ Designer + snapshot)

- [ ] **Step 1: Model**

`NotificationModel.cs`:

```csharp
using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SorobanSecurityPortalApi.Models.DbModels
{
    public enum NotificationType
    {
        CommentReply = 1,
        Mention = 2
    }

    [Table("notification")]
    public class NotificationModel
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int RecipientUserId { get; set; }

        [Required]
        public NotificationType Type { get; set; }

        [Required]
        public int ActorUserId { get; set; }

        // The comment that triggered the notification, plus its host entity (for deep-linking
        // to e.g. /vulnerability/{EntityId}#comment-{CommentId}).
        [Required]
        public int CommentId { get; set; }

        [Required]
        public EntityType EntityType { get; set; }

        [Required]
        public int EntityId { get; set; }

        [MaxLength(280)]
        public string Preview { get; set; } = string.Empty;

        public bool IsRead { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
```

- [ ] **Step 2: DbSet + indexes** — in `Db.cs`, after `Mention`:

```csharp
        public virtual DbSet<NotificationModel> Notification { get; set; }
```

In `OnModelCreating` (param `builder`), after the mention index block:

```csharp
            builder.Entity<NotificationModel>()
                .HasIndex(n => new { n.RecipientUserId, n.CreatedAt });
            builder.Entity<NotificationModel>()
                .HasIndex(n => new { n.RecipientUserId, n.IsRead });
```

- [ ] **Step 3: ProductVersion** — `appsettings.json` `"1.22"` → `"1.23"`.

- [ ] **Step 4: Migration**

```bash
cd Backend/SorobanSecurityPortalApi
dotnet ef migrations add AddNotifications --context Db
cd ../..
```
Verify `<ts>_AddNotifications.cs` creates `notification` (snake_case `recipient_user_id`, `actor_user_id`, `comment_id`, `entity_type`, `entity_id`, `preview`, `is_read`, `created_at`) + the two indexes; `DbModelSnapshot.cs` updated (else delete + regenerate; never hand-write).

- [ ] **Step 5: Build + commit**

`dotnet build Backend/SorobanSecurityPortalApi/SorobanSecurityPortalApi.csproj -v quiet --nologo` → 0 errors.

```bash
git add Backend/SorobanSecurityPortalApi/Models/DbModels/NotificationModel.cs Backend/SorobanSecurityPortalApi/Common/Data/Db.cs Backend/SorobanSecurityPortalApi/appsettings.json Backend/SorobanSecurityPortalApi/Migrations/
git commit -m "feat(comments): add notification table + migration; bump ProductVersion to 1.23"
```
(Append `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>` to every commit.)

---

### Task 2: NotificationProcessor (TDD)

**Files:**
- Create: `Backend/SorobanSecurityPortalApi/Data/Processors/NotificationProcessor.cs`
- Create: `Backend/SorobanSecurityPortalApi.Tests/Data/NotificationProcessorTests.cs`

- [ ] **Step 1: Write the failing tests**

`NotificationProcessorTests.cs` (Mock<Db> pattern; `Db.Notification` is virtual → `Setup`; reuse `TestAsyncQueryProvider`/`TestAsyncEnumerator` from `SorobanSecurityPortalApi.Tests.Services`; the `Set<T>` helper needs `Add`, `AddRange`):

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
using SorobanSecurityPortalApi.Tests.Services;
using Xunit;

namespace SorobanSecurityPortalApi.Tests.Data
{
    public class NotificationProcessorTests
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
            m.Setup(d => d.AddRange(It.IsAny<IEnumerable<T>>())).Callback<IEnumerable<T>>(src.AddRange);
            return m;
        }

        private static Mock<IDbContextFactory<Db>> Factory(List<NotificationModel> rows, out Mock<Db> dbMock)
        {
            dbMock = new Mock<Db>(
                new Mock<IDbQuery>().Object,
                new Mock<Microsoft.Extensions.Logging.ILogger<Db>>().Object,
                new Mock<IDataSourceProvider>().Object) { CallBase = true };
            dbMock.Setup(d => d.Notification).Returns(Set(rows).Object);
            dbMock.Setup(d => d.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
            var f = new Mock<IDbContextFactory<Db>>();
            f.Setup(x => x.CreateDbContextAsync(It.IsAny<CancellationToken>())).ReturnsAsync(dbMock.Object);
            return f;
        }

        private static NotificationModel N(int id, int recipient, bool read = false, NotificationType type = NotificationType.Mention, DateTime created = default)
            => new() { Id = id, RecipientUserId = recipient, IsRead = read, Type = type, ActorUserId = 1, CommentId = 1, EntityType = EntityType.Report, EntityId = 1, CreatedAt = created == default ? DateTime.UtcNow : created };

        [Fact]
        public async Task AddRange_Persists_All()
        {
            var rows = new List<NotificationModel>();
            var f = Factory(rows, out var db);
            await new NotificationProcessor(f.Object).AddRange(new[] { N(0, 5), N(0, 6) });
            rows.Should().HaveCount(2);
            db.Verify(d => d.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task ListForUser_Returns_Newest_First_Filtered_By_User()
        {
            var rows = new List<NotificationModel>
            {
                N(1, 5, created: new DateTime(2026,1,1)),
                N(2, 5, created: new DateTime(2026,1,3)),
                N(3, 6, created: new DateTime(2026,1,2)), // other user
            };
            var page = await new NotificationProcessor(Factory(rows, out _).Object).ListForUser(5, null, 1, 20);
            page.Select(n => n.Id).Should().Equal(2, 1); // user 5 only, newest first
        }

        [Fact]
        public async Task ListForUser_Filters_By_Type()
        {
            var rows = new List<NotificationModel>
            {
                N(1, 5, type: NotificationType.Mention),
                N(2, 5, type: NotificationType.CommentReply),
            };
            var page = await new NotificationProcessor(Factory(rows, out _).Object).ListForUser(5, NotificationType.Mention, 1, 20);
            page.Select(n => n.Id).Should().Equal(1);
        }

        [Fact]
        public async Task UnreadCount_Counts_Only_Unread_For_User()
        {
            var rows = new List<NotificationModel> { N(1, 5, read: false), N(2, 5, read: true), N(3, 6, read: false) };
            (await new NotificationProcessor(Factory(rows, out _).Object).UnreadCount(5)).Should().Be(1);
        }

        [Fact]
        public async Task MarkRead_Sets_Flag_Only_For_Owner()
        {
            var mine = N(1, 5); var notMine = N(2, 6);
            var f = new NotificationProcessor(Factory(new List<NotificationModel> { mine, notMine }, out _).Object);
            await f.MarkRead(1, 5);
            await f.MarkRead(2, 5); // not owner → no-op
            mine.IsRead.Should().BeTrue();
            notMine.IsRead.Should().BeFalse();
        }

        [Fact]
        public async Task MarkAllRead_Sets_All_For_User()
        {
            var rows = new List<NotificationModel> { N(1, 5, read: false), N(2, 5, read: false), N(3, 6, read: false) };
            await new NotificationProcessor(Factory(rows, out _).Object).MarkAllRead(5);
            rows.Where(n => n.RecipientUserId == 5).All(n => n.IsRead).Should().BeTrue();
            rows.Single(n => n.RecipientUserId == 6).IsRead.Should().BeFalse();
        }
    }
}
```

- [ ] **Step 2: Run → FAIL** (`--filter "FullyQualifiedName~NotificationProcessorTests"`).

- [ ] **Step 3: Implement**

`NotificationProcessor.cs`:

```csharp
using Microsoft.EntityFrameworkCore;
using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Models.DbModels;

namespace SorobanSecurityPortalApi.Data.Processors
{
    public class NotificationProcessor : INotificationProcessor
    {
        private readonly IDbContextFactory<Db> _dbFactory;
        public NotificationProcessor(IDbContextFactory<Db> dbFactory) => _dbFactory = dbFactory;

        public async Task AddRange(IEnumerable<NotificationModel> notifications)
        {
            var list = notifications.ToList();
            if (list.Count == 0) return;
            await using var db = await _dbFactory.CreateDbContextAsync();
            db.Notification.AddRange(list);
            await db.SaveChangesAsync();
        }

        public async Task<List<NotificationModel>> ListForUser(int userId, NotificationType? type, int page, int pageSize)
        {
            page = Math.Max(1, page);
            pageSize = Math.Max(1, Math.Min(100, pageSize));
            await using var db = await _dbFactory.CreateDbContextAsync();
            var q = db.Notification.AsNoTracking().Where(n => n.RecipientUserId == userId);
            if (type.HasValue) q = q.Where(n => n.Type == type.Value);
            return await q.OrderByDescending(n => n.CreatedAt).ThenByDescending(n => n.Id)
                .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
        }

        public async Task<int> UnreadCount(int userId)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            return await db.Notification.AsNoTracking().CountAsync(n => n.RecipientUserId == userId && !n.IsRead);
        }

        public async Task MarkRead(int id, int userId)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var n = await db.Notification.FirstOrDefaultAsync(x => x.Id == id && x.RecipientUserId == userId);
            if (n == null || n.IsRead) return;
            n.IsRead = true;
            await db.SaveChangesAsync();
        }

        public async Task MarkAllRead(int userId)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var unread = await db.Notification.Where(n => n.RecipientUserId == userId && !n.IsRead).ToListAsync();
            foreach (var n in unread) n.IsRead = true;
            if (unread.Count > 0) await db.SaveChangesAsync();
        }
    }

    public interface INotificationProcessor
    {
        Task AddRange(IEnumerable<NotificationModel> notifications);
        Task<List<NotificationModel>> ListForUser(int userId, NotificationType? type, int page, int pageSize);
        Task<int> UnreadCount(int userId);
        Task MarkRead(int id, int userId);
        Task MarkAllRead(int userId);
    }
}
```

- [ ] **Step 4: Run → PASS** (6 tests). Build.

- [ ] **Step 5: Commit**

```bash
git add Backend/SorobanSecurityPortalApi/Data/Processors/NotificationProcessor.cs Backend/SorobanSecurityPortalApi.Tests/Data/NotificationProcessorTests.cs
git commit -m "feat(comments): add NotificationProcessor with tests"
```

---

### Task 3: NotificationService (TDD)

**Files:**
- Create: `Backend/SorobanSecurityPortalApi/Models/ViewModels/NotificationViewModel.cs`
- Create: `Backend/SorobanSecurityPortalApi/Services/ControllersServices/NotificationService.cs`
- Create: `Backend/SorobanSecurityPortalApi.Tests/Services/NotificationServiceTests.cs`
- Modify: `Backend/SorobanSecurityPortalApi/Models/Mapping/` — add a profile OR map inline (see below)
- Modify: `Backend/SorobanSecurityPortalApi/Startup.cs` (register `INotificationService`)

- [ ] **Step 1: DTO + AutoMapper profile**

`NotificationViewModel.cs`:

```csharp
using System;
using SorobanSecurityPortalApi.Models.DbModels;

namespace SorobanSecurityPortalApi.Models.ViewModels
{
    public class NotificationViewModel
    {
        public int Id { get; set; }
        public NotificationType Type { get; set; }
        public int ActorUserId { get; set; }
        public int CommentId { get; set; }
        public EntityType EntityType { get; set; }
        public int EntityId { get; set; }
        public string Preview { get; set; } = string.Empty;
        public bool IsRead { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
```

Create `Models/Mapping/NotificationModelProfile.cs`:

```csharp
using AutoMapper;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;

namespace SorobanSecurityPortalApi.Models.Mapping
{
    public class NotificationModelProfile : Profile
    {
        public NotificationModelProfile() => CreateMap<NotificationModel, NotificationViewModel>();
    }
}
```

- [ ] **Step 2: Write the failing tests**

`NotificationServiceTests.cs`:

```csharp
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using AutoMapper;
using FluentAssertions;
using Moq;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.Mapping;
using SorobanSecurityPortalApi.Services.ControllersServices;
using Xunit;

namespace SorobanSecurityPortalApi.Tests.Services
{
    public class NotificationServiceTests
    {
        private readonly Mock<INotificationProcessor> _processor = new();
        private readonly Mock<IUserContextAccessor> _userContext = new();
        private readonly IMapper _mapper = new MapperConfiguration(c => c.AddProfile<NotificationModelProfile>()).CreateMapper();
        private NotificationService Build() => new(_processor.Object, _userContext.Object, _mapper);

        [Fact]
        public async Task GetUnreadCount_Uses_Current_User()
        {
            _userContext.Setup(u => u.GetLoginIdAsync()).ReturnsAsync(5);
            _processor.Setup(p => p.UnreadCount(5)).ReturnsAsync(3);
            (await Build().GetUnreadCount()).Should().Be(3);
        }

        [Fact]
        public async Task NotifyForNewComment_Reply_To_Other_Creates_Reply_Notification()
        {
            List<NotificationModel>? saved = null;
            _processor.Setup(p => p.AddRange(It.IsAny<IEnumerable<NotificationModel>>()))
                .Callback<IEnumerable<NotificationModel>>(x => saved = x.ToList()).Returns(Task.CompletedTask);

            await Build().NotifyForNewComment(actorId: 5, repliedToAuthorId: 9, mentionedUserIds: new List<int>(),
                commentId: 100, EntityType.Report, entityId: 7, "hi");

            saved.Should().ContainSingle();
            saved![0].Type.Should().Be(NotificationType.CommentReply);
            saved[0].RecipientUserId.Should().Be(9);
            saved[0].ActorUserId.Should().Be(5);
            saved[0].CommentId.Should().Be(100);
        }

        [Fact]
        public async Task NotifyForNewComment_Does_Not_Notify_Self_Reply()
        {
            await Build().NotifyForNewComment(5, repliedToAuthorId: 5, new List<int>(), 100, EntityType.Report, 7, "x");
            _processor.Verify(p => p.AddRange(It.IsAny<IEnumerable<NotificationModel>>()), Times.Never);
        }

        [Fact]
        public async Task NotifyForNewComment_Mentions_Exclude_Actor_And_Reply_Recipient()
        {
            List<NotificationModel>? saved = null;
            _processor.Setup(p => p.AddRange(It.IsAny<IEnumerable<NotificationModel>>()))
                .Callback<IEnumerable<NotificationModel>>(x => saved = x.ToList()).Returns(Task.CompletedTask);

            // actor 5, reply to 9; mentions 5 (self), 9 (already getting reply), 11, 12
            await Build().NotifyForNewComment(5, 9, new List<int> { 5, 9, 11, 12 }, 100, EntityType.Report, 7, "hi @x");

            var mentionRecipients = saved!.Where(n => n.Type == NotificationType.Mention).Select(n => n.RecipientUserId).ToList();
            mentionRecipients.Should().BeEquivalentTo(new[] { 11, 12 });
            saved.Count(n => n.RecipientUserId == 9).Should().Be(1); // 9 gets reply only, not a duplicate mention
        }

        [Fact]
        public async Task NotifyForNewComment_Caps_Mentions()
        {
            List<NotificationModel>? saved = null;
            _processor.Setup(p => p.AddRange(It.IsAny<IEnumerable<NotificationModel>>()))
                .Callback<IEnumerable<NotificationModel>>(x => saved = x.ToList()).Returns(Task.CompletedTask);

            var many = Enumerable.Range(100, 50).ToList(); // 50 distinct mentioned users
            await Build().NotifyForNewComment(5, null, many, 100, EntityType.Report, 7, "x");

            saved!.Count(n => n.Type == NotificationType.Mention).Should().Be(NotificationService.MaxMentionNotifications);
        }

        [Fact]
        public async Task NotifyForNewComment_No_Recipients_Skips_Persist()
        {
            await Build().NotifyForNewComment(5, null, new List<int> { 5 }, 100, EntityType.Report, 7, "x");
            _processor.Verify(p => p.AddRange(It.IsAny<IEnumerable<NotificationModel>>()), Times.Never);
        }
    }
}
```

- [ ] **Step 3: Run → FAIL.**

- [ ] **Step 4: Implement**

`NotificationService.cs`:

```csharp
using AutoMapper;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;

namespace SorobanSecurityPortalApi.Services.ControllersServices
{
    public interface INotificationService
    {
        Task<List<NotificationViewModel>> GetNotifications(NotificationType? type, int page);
        Task<int> GetUnreadCount();
        Task MarkRead(int id);
        Task MarkAllRead();
        Task NotifyForNewComment(int actorId, int? repliedToAuthorId, IReadOnlyList<int> mentionedUserIds,
            int commentId, EntityType entityType, int entityId, string preview);
    }

    public class NotificationService : INotificationService
    {
        public const int MaxMentionNotifications = 10;
        private const int PreviewMaxLength = 280;

        private readonly INotificationProcessor _processor;
        private readonly IUserContextAccessor _userContext;
        private readonly IMapper _mapper;

        public NotificationService(INotificationProcessor processor, IUserContextAccessor userContext, IMapper mapper)
        {
            _processor = processor;
            _userContext = userContext;
            _mapper = mapper;
        }

        public async Task<List<NotificationViewModel>> GetNotifications(NotificationType? type, int page)
        {
            var userId = await _userContext.GetLoginIdAsync();
            var rows = await _processor.ListForUser(userId, type, page, 20);
            return _mapper.Map<List<NotificationViewModel>>(rows);
        }

        public async Task<int> GetUnreadCount() => await _processor.UnreadCount(await _userContext.GetLoginIdAsync());

        public async Task MarkRead(int id) => await _processor.MarkRead(id, await _userContext.GetLoginIdAsync());

        public async Task MarkAllRead() => await _processor.MarkAllRead(await _userContext.GetLoginIdAsync());

        public async Task NotifyForNewComment(int actorId, int? repliedToAuthorId, IReadOnlyList<int> mentionedUserIds,
            int commentId, EntityType entityType, int entityId, string preview)
        {
            preview = preview?.Length > PreviewMaxLength ? preview.Substring(0, PreviewMaxLength) : (preview ?? string.Empty);
            var notifications = new List<NotificationModel>();

            // Reply notification to the comment being replied to (never to yourself).
            if (repliedToAuthorId.HasValue && repliedToAuthorId.Value != actorId)
                notifications.Add(Make(repliedToAuthorId.Value, NotificationType.CommentReply, actorId, commentId, entityType, entityId, preview));

            // Mention notifications: exclude the actor and the reply recipient (no double-notify), dedupe, cap.
            var mentionTargets = (mentionedUserIds ?? new List<int>())
                .Where(id => id != actorId && id != repliedToAuthorId)
                .Distinct()
                .Take(MaxMentionNotifications);
            foreach (var uid in mentionTargets)
                notifications.Add(Make(uid, NotificationType.Mention, actorId, commentId, entityType, entityId, preview));

            if (notifications.Count > 0)
                await _processor.AddRange(notifications);
        }

        private static NotificationModel Make(int recipient, NotificationType type, int actor, int commentId, EntityType et, int eid, string preview)
            => new()
            {
                RecipientUserId = recipient,
                Type = type,
                ActorUserId = actor,
                CommentId = commentId,
                EntityType = et,
                EntityId = eid,
                Preview = preview,
                CreatedAt = DateTime.UtcNow
            };
    }
}
```

- [ ] **Step 5: Run → PASS** (6 tests).

- [ ] **Step 6: Register** in `Startup.cs` next to the other services:

```csharp
        services.AddScoped<INotificationService, NotificationService>();
```
(`INotificationProcessor` auto-registers by convention.)

- [ ] **Step 7: Build + commit**

```bash
git add Backend/SorobanSecurityPortalApi/Models/ViewModels/NotificationViewModel.cs Backend/SorobanSecurityPortalApi/Models/Mapping/NotificationModelProfile.cs Backend/SorobanSecurityPortalApi/Services/ControllersServices/NotificationService.cs Backend/SorobanSecurityPortalApi/Startup.cs Backend/SorobanSecurityPortalApi.Tests/Services/NotificationServiceTests.cs
git commit -m "feat(comments): add NotificationService (list/unread/mark + reply/mention builder) with tests"
```

---

### Task 4: NotificationsController + full suite

**Files:**
- Create: `Backend/SorobanSecurityPortalApi/Controllers/NotificationsController.cs`

- [ ] **Step 1: Implement**

`NotificationsController.cs`:

```csharp
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Services.ControllersServices;

namespace SorobanSecurityPortalApi.Controllers
{
    [ApiController]
    [Route("api/v1/notifications")]
    [Authorize]
    public class NotificationsController : ControllerBase
    {
        private readonly INotificationService _service;
        public NotificationsController(INotificationService service) => _service = service;

        [HttpGet]
        public async Task<IActionResult> Get([FromQuery] NotificationType? type, [FromQuery] int page = 1)
            => Ok(await _service.GetNotifications(type, page));

        [HttpGet("unread-count")]
        public async Task<IActionResult> UnreadCount() => Ok(await _service.GetUnreadCount());

        [HttpPost("{id}/read")]
        public async Task<IActionResult> Read(int id)
        {
            if (id <= 0) return BadRequest("Notification ID must be a positive integer.");
            await _service.MarkRead(id);
            return NoContent();
        }

        [HttpPost("read-all")]
        public async Task<IActionResult> ReadAll()
        {
            await _service.MarkAllRead();
            return NoContent();
        }
    }
}
```

- [ ] **Step 2: Build** → 0 errors.

- [ ] **Step 3: Full suite** — `dotnet test Backend/SorobanSecurityPortalApi.Tests` → 0 failures. Total = 280 + 6 (processor) + 6 (service) = **292**.

- [ ] **Step 4: Commit**

```bash
git add Backend/SorobanSecurityPortalApi/Controllers/NotificationsController.cs
git commit -m "feat(comments): add NotificationsController (list/unread-count/read/read-all)"
```

---

## Self-Review

**Spec coverage (#65 backbone + reply/mention notification logic):** `notification` table + processor + service + REST API (list, unread-count, mark read, mark all); `NotifyForNewComment` builds reply (#61) + mention (#75) notifications, self-filtered, deduped (reply recipient not double-mentioned), mention-capped (#4 carry-forward addressed). **Deferred to PR5b:** SignalR real-time push, wiring `NotifyForNewComment` into `CommentService` create, the #1 non-fatal-side-effects fix.

**Placeholder scan:** none.

**Type consistency:** `INotificationProcessor` methods match the service + tests; `NotificationService` ctor `(INotificationProcessor, IUserContextAccessor, IMapper)` matches `Build()`; `NotifyForNewComment` signature matches its tests and the future `CommentService` call site (PR5b); `NotificationViewModel` mapped via `NotificationModelProfile`; `MaxMentionNotifications` public const referenced by a test.

## Carry-forwards (PR5b)
- SignalR hub `/hubs/notifications` + Redis backplane (reuse `DISTRIBUTEDCACHEURL`) + JWT-on-socket + `IRealtimePublisher` (abstraction over `IHubContext`), and `NotifyForNewComment` also pushes live after persisting.
- Wire `CommentService.AddComment` → capture `parent.AuthorId` (the replied-to author) + the mention ids returned by `ReplaceCommentMentions` → call `NotifyForNewComment`, all wrapped **non-fatal** (fixes audit #1).
- Filter notifications/mentions on **hidden/deleted** comments (don't notify about suppressed content).
- `EntityType` on the notification is the comment's host entity (Vulnerability/Report) for deep-linking; PR8 builds the URL + the bell + `/mentions` inbox (#76, filter `Type==Mention`).

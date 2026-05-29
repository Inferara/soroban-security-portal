# Real-Time Notifications (SignalR) — Implementation Plan (PR5c)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Push notifications to recipients in real time over SignalR (Redis backplane, JWT-authenticated socket), so the bell/inbox (PR8) update live instead of only on poll.

**Architecture:** A JWT-authenticated `NotificationHub` at `/hubs/notifications` (Redis backplane for multi-instance fan-out). `NotificationService.NotifyForNewComment` persists (PR5) then pushes each notification via `IRealtimePublisher`, whose SignalR implementation maps `RecipientUserId` → login name (the default SignalR user identifier = the `NameIdentifier` claim) and calls `Clients.User(name).SendAsync("ReceiveNotification", dto)`.

**Tech Stack:** ASP.NET Core SignalR + `Microsoft.AspNetCore.SignalR.StackExchangeRedis`, EF Core, xUnit + Moq + FluentAssertions. Branch `feature/comments-discussion`. Baseline: 295 tests green.

**Testability note:** The push *seam* (NotificationService → `IRealtimePublisher`) and the publisher's id→name→`Clients.User` mapping are unit-tested with mocks. The hub, Redis backplane, JWT-on-socket handshake, and websocket transport are **infrastructure verified by build** (and a live smoke test on deploy) — not by mock-based unit tests.

**Scope:** SignalR hub + Redis backplane + JWT-on-socket + `IRealtimePublisher` + `NotificationService` live push. **Excludes (PR8 frontend):** `useSignalR` client, the bell, `/mentions` inbox.

---

### Task 1: SignalR infrastructure + `IRealtimePublisher`

**Files:**
- Modify: `Backend/SorobanSecurityPortalApi/SorobanSecurityPortalApi.csproj` (add backplane package)
- Create: `Backend/SorobanSecurityPortalApi/Hubs/NotificationHub.cs`
- Create: `Backend/SorobanSecurityPortalApi/Services/Realtime/RealtimePublisher.cs` (`IRealtimePublisher` + `SignalRNotificationPublisher`)
- Modify: `Backend/SorobanSecurityPortalApi/Startup.cs` (AddSignalR+Redis, JWT-on-socket event, MapHub, DI)
- Create: `Backend/SorobanSecurityPortalApi.Tests/Services/RealtimePublisherTests.cs`

- [ ] **Step 1: Add the SignalR Redis backplane package**

Run: `dotnet add Backend/SorobanSecurityPortalApi/SorobanSecurityPortalApi.csproj package Microsoft.AspNetCore.SignalR.StackExchangeRedis --version 10.0.7`
(If that exact version fails to restore, re-run without `--version` to take the latest compatible.) Then `dotnet restore Backend/SorobanSecurityPortalApi/SorobanSecurityPortalApi.csproj`.

- [ ] **Step 2: Create the hub**

`Hubs/NotificationHub.cs`:

```csharp
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace SorobanSecurityPortalApi.Hubs
{
    // Clients connect and receive server-pushed "ReceiveNotification" events; no client->server methods.
    // SignalR's default IUserIdProvider keys connections by the NameIdentifier claim (= login name),
    // which is what SignalRNotificationPublisher targets via Clients.User(name).
    [Authorize]
    public class NotificationHub : Hub
    {
    }
}
```

- [ ] **Step 3: Create `IRealtimePublisher` + SignalR implementation**

`Services/Realtime/RealtimePublisher.cs`:

```csharp
using Microsoft.AspNetCore.SignalR;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Hubs;
using SorobanSecurityPortalApi.Models.ViewModels;

namespace SorobanSecurityPortalApi.Services.Realtime
{
    public interface IRealtimePublisher
    {
        Task NotifyUserAsync(int recipientUserId, NotificationViewModel notification);
    }

    public class SignalRNotificationPublisher : IRealtimePublisher
    {
        public const string ReceiveNotificationMethod = "ReceiveNotification";

        private readonly IHubContext<NotificationHub> _hub;
        private readonly ILoginProcessor _loginProcessor;

        public SignalRNotificationPublisher(IHubContext<NotificationHub> hub, ILoginProcessor loginProcessor)
        {
            _hub = hub;
            _loginProcessor = loginProcessor;
        }

        public async Task NotifyUserAsync(int recipientUserId, NotificationViewModel notification)
        {
            // SignalR keys connections by login name (NameIdentifier claim); map id -> name.
            var login = await _loginProcessor.GetById(recipientUserId);
            if (login == null) return;
            await _hub.Clients.User(login.Login).SendAsync(ReceiveNotificationMethod, notification);
        }
    }
}
```

- [ ] **Step 4: Write the failing publisher tests**

`RealtimePublisherTests.cs`:

```csharp
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.AspNetCore.SignalR;
using Moq;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Hubs;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;
using SorobanSecurityPortalApi.Services.Realtime;
using Xunit;

namespace SorobanSecurityPortalApi.Tests.Services
{
    public class RealtimePublisherTests
    {
        [Fact]
        public async Task NotifyUserAsync_Resolves_Login_And_Sends_To_That_User()
        {
            var clientProxy = new Mock<IClientProxy>();
            var clients = new Mock<IHubClients>();
            clients.Setup(c => c.User("alice")).Returns(clientProxy.Object);
            var hub = new Mock<IHubContext<NotificationHub>>();
            hub.Setup(h => h.Clients).Returns(clients.Object);

            var login = new Mock<ILoginProcessor>();
            login.Setup(l => l.GetById(5)).ReturnsAsync(new LoginModel { LoginId = 5, Login = "alice" });

            var dto = new NotificationViewModel { Id = 1, CommentId = 9 };
            await new SignalRNotificationPublisher(hub.Object, login.Object).NotifyUserAsync(5, dto);

            clients.Verify(c => c.User("alice"), Times.Once);
            clientProxy.Verify(p => p.SendCoreAsync(
                SignalRNotificationPublisher.ReceiveNotificationMethod,
                It.Is<object[]>(a => a.Length == 1 && a[0] == dto),
                It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task NotifyUserAsync_NoOp_When_User_Missing()
        {
            var clients = new Mock<IHubClients>();
            var hub = new Mock<IHubContext<NotificationHub>>();
            hub.Setup(h => h.Clients).Returns(clients.Object);
            var login = new Mock<ILoginProcessor>();
            login.Setup(l => l.GetById(It.IsAny<int>())).ReturnsAsync((LoginModel?)null);

            await new SignalRNotificationPublisher(hub.Object, login.Object).NotifyUserAsync(999, new NotificationViewModel());

            clients.Verify(c => c.User(It.IsAny<string>()), Times.Never);
        }
    }
}
```

> `SendAsync(method, arg)` is an extension over `IClientProxy.SendCoreAsync(method, object[] args, CancellationToken)` — hence the tests verify `SendCoreAsync`.

- [ ] **Step 5: Run → FAIL** (`--filter "FullyQualifiedName~RealtimePublisherTests"`; types not yet wired / building).

- [ ] **Step 6: Wire SignalR into `Startup.cs`**

(a) **AddSignalR + Redis backplane** — near the existing `AddStackExchangeRedisCache` block (around line 74), add:

```csharp
        services.AddSignalR().AddStackExchangeRedis(options =>
        {
            options.Configuration = new StackExchange.Redis.ConfigurationOptions
            {
                EndPoints = { _config.DistributedCacheUrl },
                Password = _config.DistributedCachePassword,
                AbortOnConnectFail = false
            };
        });
```

(b) **JWT-on-socket** — replace the existing `.AddJwtBearer(options => { options.TokenValidationParameters = tokenValidationParameters; })` with:

```csharp
            .AddJwtBearer(options =>
            {
                options.TokenValidationParameters = tokenValidationParameters;
                // SignalR sends the JWT on the websocket handshake as ?access_token=...
                options.Events = new Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerEvents
                {
                    OnMessageReceived = context =>
                    {
                        var accessToken = context.Request.Query["access_token"];
                        var path = context.HttpContext.Request.Path;
                        if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
                            context.Token = accessToken;
                        return Task.CompletedTask;
                    }
                };
            });
```

(c) **MapHub** — in `app.UseEndpoints(...)` next to `endpoints.MapControllers();` add:

```csharp
            endpoints.MapHub<SorobanSecurityPortalApi.Hubs.NotificationHub>("/hubs/notifications");
```

(d) **DI** — register the publisher next to the other service registrations:

```csharp
        services.AddScoped<IRealtimePublisher, SignalRNotificationPublisher>();
```
(Add `using SorobanSecurityPortalApi.Services.Realtime;` to Startup if needed.)

- [ ] **Step 7: Build + run publisher tests → PASS**

`dotnet build Backend/SorobanSecurityPortalApi/SorobanSecurityPortalApi.csproj -v quiet --nologo` → 0 errors. `dotnet test Backend/SorobanSecurityPortalApi.Tests --filter "FullyQualifiedName~RealtimePublisherTests"` → 2 pass.

- [ ] **Step 8: Commit**

```bash
git add Backend/SorobanSecurityPortalApi/SorobanSecurityPortalApi.csproj Backend/SorobanSecurityPortalApi/Hubs/NotificationHub.cs Backend/SorobanSecurityPortalApi/Services/Realtime/RealtimePublisher.cs Backend/SorobanSecurityPortalApi/Startup.cs Backend/SorobanSecurityPortalApi.Tests/Services/RealtimePublisherTests.cs
git commit -m "feat(comments): add SignalR NotificationHub + Redis backplane + JWT-on-socket + IRealtimePublisher"
```
(Append `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>` trailer.)

---

### Task 2: NotificationService pushes live (TDD)

**Files:**
- Modify: `Backend/SorobanSecurityPortalApi/Services/ControllersServices/NotificationService.cs` (inject `IRealtimePublisher`; push after persist)
- Modify: `Backend/SorobanSecurityPortalApi.Tests/Services/NotificationServiceTests.cs` (inject mock; add test)

- [ ] **Step 1: Add the failing test**

In `NotificationServiceTests.cs`, add a field `private readonly Mock<IRealtimePublisher> _publisher = new();` (`using SorobanSecurityPortalApi.Services.Realtime;`), pass `_publisher.Object` as the new LAST `NotificationService` ctor arg in `Build()`. Add:

```csharp
        [Fact]
        public async Task NotifyForNewComment_Pushes_Each_Persisted_Notification_Realtime()
        {
            await Build().NotifyForNewComment(5, repliedToAuthorId: 9, mentionedUserIds: new List<int> { 11 },
                commentId: 100, EntityType.Report, entityId: 7, "hi");

            // recipients: 9 (reply) + 11 (mention) = 2 live pushes
            _publisher.Verify(p => p.NotifyUserAsync(9, It.IsAny<NotificationViewModel>()), Times.Once);
            _publisher.Verify(p => p.NotifyUserAsync(11, It.IsAny<NotificationViewModel>()), Times.Once);
        }
```

(Existing `NotifyForNewComment` tests still pass — the publisher mock is a no-op by default; the no-recipient test must still not push: optionally add `_publisher.Verify(..., Times.Never)` there, but not required.)

- [ ] **Step 2: Run → FAIL** (ctor arity).

- [ ] **Step 3: Implement**

In `NotificationService.cs`: add `using SorobanSecurityPortalApi.Services.Realtime;`, add `IRealtimePublisher` as the LAST ctor param + a `_realtimePublisher` field. At the end of `NotifyForNewComment`, replace the persist block with persist-then-push:

```csharp
            if (notifications.Count > 0)
            {
                await _processor.AddRange(notifications);
                // Best-effort live push (persisted copy is the source of truth; a push failure
                // just means the recipient sees it on next poll/reconnect).
                foreach (var n in notifications)
                {
                    try { await _realtimePublisher.NotifyUserAsync(n.RecipientUserId, _mapper.Map<NotificationViewModel>(n)); }
                    catch { /* swallow — delivery is best-effort */ }
                }
            }
```

- [ ] **Step 4: Run → PASS** (`--filter "FullyQualifiedName~NotificationServiceTests"`, prior + 1 new). Build.

- [ ] **Step 5: Full suite + commit**

`dotnet test Backend/SorobanSecurityPortalApi.Tests` → 0 failures, total = 295 + 2 (publisher) + 1 (service) = **298**.

```bash
git add Backend/SorobanSecurityPortalApi/Services/ControllersServices/NotificationService.cs Backend/SorobanSecurityPortalApi.Tests/Services/NotificationServiceTests.cs
git commit -m "feat(comments): push notifications live via IRealtimePublisher after persisting"
```

---

## Self-Review

**Spec coverage (#56 backend):** SignalR hub at `/hubs/notifications` (Task 1) with Redis backplane (reuses `DistributedCacheUrl`/`DistributedCachePassword`) + JWT-on-socket (token from `?access_token=` for `/hubs`); `IRealtimePublisher` maps recipient id → login name → `Clients.User`; `NotificationService` pushes live after persisting (Task 2), best-effort. Frontend `useSignalR` client = PR8.

**Placeholder scan:** none.

**Type consistency:** `IRealtimePublisher.NotifyUserAsync(int, NotificationViewModel)` consumed by `NotificationService` + verified in both publisher and service tests; `ILoginProcessor.GetById(int)→LoginModel?` (`.Login` = login name) used by the publisher; `NotificationViewModel` is the push payload (mapped from `NotificationModel`); `SignalRNotificationPublisher.ReceiveNotificationMethod` const shared by impl + test.

**Infra not unit-tested (by design):** hub auth, Redis backplane connection, JWT-on-socket handshake, websocket transport. Verified by build; recommend a live smoke test on the K3S deploy (connect a SignalR client with a real JWT, post a reply/mention, observe `ReceiveNotification`).

## Carry-forwards
- **Live smoke test** on deploy (build+push API image, helm upgrade, connect a SignalR client) — analogous to the migration verification.
- Suppress notifications about hidden/deleted comments (still open).
- PR8: `useSignalR` hook + `NotificationBell` (subscribe to `ReceiveNotification`, merge with the REST list/unread-count) + `/mentions` inbox.

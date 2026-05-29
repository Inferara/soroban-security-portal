# Visitor Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add server-side, bot-filtered page-view tracking to the four public detail pages (Report, Auditor, Vulnerability, Protocol), show a public "Views" counter on each, and add an admin **Statistics** page — including an admin-only link-preview/crawler ("shares") count.

**Architecture:** One generic `page_view` table records raw view events with a salted hash for uniqueness (no raw IP/PII). A new `PageViewService`/`PageViewProcessor` pair (auto-registered by the existing DI convention scan) does hashing, server-side bot classification, day-level dedupe and aggregation. `AnalyticsController` exposes a public record + count endpoint and an admin-only statistics endpoint. The SPA records a Human view on mount (so JS-less bots can't inflate it); `OgController` records a Crawler view when it serves link-preview metadata. The UI adds a "Views" stat card to each detail page and a new admin Statistics page.

**Tech Stack:** .NET 10 / EF Core (Npgsql), xUnit + Moq + FluentAssertions; React 19 + MUI 9 + `@mui/x-charts`, Redux Toolkit, Vitest + Testing Library, Playwright.

**Conventions reused (do not re-invent):**
- Enum `SorobanSecurityPortalApi.Models.DbModels.EntityType` already exists: `Protocol=0, Auditor=1, Vulnerability=2, Report=3`. **Reuse it.**
- `RoleAuthorizeAttribute(params Role[])` in `SorobanSecurityPortalApi.Authorization.Attributes`; `Role` enum `User=1, Admin=2, Contributor=3, Moderator=4`.
- Processors take `IDbContextFactory<Db>` and use `await using var db = await _dbFactory.CreateDbContextAsync();`.
- Services + processors are auto-registered by the convention scan in `Startup.cs` (`I*Service`→`*Service`, `I*Processor`→`*Processor`). **No manual DI registration needed.**
- UI api calls live in `UI/src/api/soroban-security-portal/soroban-security-portal-api.ts` and use `const client = await getRestClient();`.
- `StatisticCard { icon, iconColor, value, label, tooltip? }` from `UI/src/components/details` (exported via `StatisticsCards`).

---

## Phase 1 — Backend data model & enums

### Task 1: PageView entity + source enum + DbSet + indexes

**Files:**
- Create: `Backend/SorobanSecurityPortalApi/Models/DbModels/PageViewModel.cs`
- Modify: `Backend/SorobanSecurityPortalApi/Common/Data/Db.cs` (add DbSet near other DbSets ~line 36; add indexes in `OnModelCreating` after the `NotificationModel` index block ~line 201)

- [ ] **Step 1: Create the model**

```csharp
using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SorobanSecurityPortalApi.Models.DbModels
{
    // How a view arrived. Human = recorded by the SPA on mount; Crawler = recorded by
    // OgController when a social link-preview bot fetches OpenGraph metadata.
    public enum PageViewSource
    {
        Human = 1,
        Crawler = 2
    }

    [Table("page_view")]
    public class PageViewModel
    {
        [Key]
        public int Id { get; set; }

        // Reuses the shared EntityType enum (Protocol/Auditor/Vulnerability/Report).
        [Required]
        public EntityType EntityType { get; set; }

        [Required]
        public int EntityId { get; set; }

        [Required]
        public DateTime ViewedAt { get; set; } = DateTime.UtcNow;

        // Salted HMAC-SHA256 of (ip + user-agent + UTC date). Pseudonymous; NO raw IP/PII stored.
        [Required]
        [MaxLength(64)]
        public string VisitorHash { get; set; } = string.Empty;

        [Required]
        public PageViewSource Source { get; set; }
    }
}
```

- [ ] **Step 2: Add the DbSet** in `Db.cs` immediately after `public virtual DbSet<NotificationModel> Notification { get; set; }`:

```csharp
        public DbSet<PageViewModel> PageView { get; set; }
```

- [ ] **Step 3: Add indexes** in `OnModelCreating`, right after the two `builder.Entity<NotificationModel>().HasIndex(...)` lines:

```csharp
            builder.Entity<PageViewModel>()
                .HasIndex(p => new { p.EntityType, p.EntityId });
            builder.Entity<PageViewModel>()
                .HasIndex(p => p.ViewedAt);
            // Supports the per-day dedupe lookup (same visitor, same entity, same day).
            builder.Entity<PageViewModel>()
                .HasIndex(p => new { p.EntityType, p.EntityId, p.VisitorHash });
```

- [ ] **Step 4: Build to verify it compiles**

Run: `dotnet build Backend/SorobanSecurityPortalApi/SorobanSecurityPortalApi.csproj`
Expected: Build succeeded (warnings OK).

- [ ] **Step 5: Commit**

```bash
git add Backend/SorobanSecurityPortalApi/Models/DbModels/PageViewModel.cs Backend/SorobanSecurityPortalApi/Common/Data/Db.cs
git commit -m "feat(analytics): add page_view entity, source enum and indexes"
```

---

### Task 2: Result/view-model DTOs for analytics

**Files:**
- Create: `Backend/SorobanSecurityPortalApi/Models/ViewModels/AnalyticsViewModels.cs`

- [ ] **Step 1: Create the DTOs**

```csharp
using System;
using System.Collections.Generic;
using SorobanSecurityPortalApi.Models.DbModels;

namespace SorobanSecurityPortalApi.Models.ViewModels
{
    // Public per-entity counter payload.
    public class PageViewCountViewModel
    {
        public int Total { get; set; }
        public int Unique { get; set; }
    }

    public class TopEntityViewModel
    {
        public EntityType EntityType { get; set; }
        public int EntityId { get; set; }
        public string Title { get; set; } = string.Empty;
        public int Views { get; set; }
    }

    public class DailyViewsViewModel
    {
        public DateTime Date { get; set; }
        public int Views { get; set; }
    }

    // Admin dashboard payload.
    public class AnalyticsStatisticsViewModel
    {
        public int TotalHumanViews { get; set; }
        public int UniqueVisitors { get; set; }
        public int CrawlerShares { get; set; }
        public List<TopEntityViewModel> TopEntities { get; set; } = new();
        public List<DailyViewsViewModel> Daily { get; set; } = new();
    }
}
```

- [ ] **Step 2: Build** — `dotnet build Backend/SorobanSecurityPortalApi/SorobanSecurityPortalApi.csproj` → succeeds.

- [ ] **Step 3: Commit**

```bash
git add Backend/SorobanSecurityPortalApi/Models/ViewModels/AnalyticsViewModels.cs
git commit -m "feat(analytics): add analytics view-model DTOs"
```

---

## Phase 2 — Bot detection helper (TDD)

### Task 3: `BotUserAgent` helper

**Files:**
- Create: `Backend/SorobanSecurityPortalApi/Common/BotUserAgent.cs`
- Test: `Backend/SorobanSecurityPortalApi.Tests/Common/BotUserAgentTests.cs`

- [ ] **Step 1: Write the failing test**

```csharp
using FluentAssertions;
using SorobanSecurityPortalApi.Common;
using Xunit;

namespace SorobanSecurityPortalApi.Tests.Common
{
    public class BotUserAgentTests
    {
        [Theory]
        [InlineData("Mozilla/5.0 (compatible; Twitterbot/1.0)")]
        [InlineData("facebookexternalhit/1.1")]
        [InlineData("LinkedInBot/1.0")]
        [InlineData("TelegramBot (like TwitterBot)")]
        [InlineData("Mozilla/5.0 (compatible; bingbot/2.0)")]
        [InlineData("some-generic-crawler/2.0")]
        public void IsBot_TrueForKnownBots(string ua) => BotUserAgent.IsBot(ua).Should().BeTrue();

        [Theory]
        [InlineData("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36")]
        [InlineData("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605 Safari/604")]
        public void IsBot_FalseForRealBrowsers(string ua) => BotUserAgent.IsBot(ua).Should().BeFalse();

        [Fact]
        public void IsBot_TrueForEmptyOrNull()
        {
            BotUserAgent.IsBot(null).Should().BeTrue();
            BotUserAgent.IsBot("").Should().BeTrue();
        }
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `dotnet test Backend/SorobanSecurityPortalApi.Tests --filter BotUserAgentTests`
Expected: FAIL — `BotUserAgent` does not exist.

- [ ] **Step 3: Implement the helper**

```csharp
using System;

namespace SorobanSecurityPortalApi.Common
{
    // Server-side backstop for the crawler User-Agents the UI nginx already diverts to OgController.
    // Used to classify a recorded view as Human vs Crawler so bots never inflate human counts.
    public static class BotUserAgent
    {
        private static readonly string[] Tokens =
        {
            // Same social/link-preview crawlers nginx routes to /__og:
            "facebookexternalhit", "Facebot", "Twitterbot", "LinkedInBot", "Slackbot",
            "Slack-ImgProxy", "TelegramBot", "Discordbot", "WhatsApp", "Pinterest",
            "redditbot", "Embedly", "vkShare", "SkypeUriPreview", "nuzzel", "Applebot", "bingbot",
            // Generic crawler markers as a backstop:
            "bot", "crawler", "spider", "crawl"
        };

        public static bool IsBot(string? userAgent)
        {
            if (string.IsNullOrWhiteSpace(userAgent)) return true; // no UA → not a real browser visit
            foreach (var token in Tokens)
                if (userAgent.Contains(token, StringComparison.OrdinalIgnoreCase))
                    return true;
            return false;
        }
    }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `dotnet test Backend/SorobanSecurityPortalApi.Tests --filter BotUserAgentTests`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add Backend/SorobanSecurityPortalApi/Common/BotUserAgent.cs Backend/SorobanSecurityPortalApi.Tests/Common/BotUserAgentTests.cs
git commit -m "feat(analytics): add server-side bot user-agent classifier"
```

---

## Phase 3 — Data access processor

### Task 4: `PageViewProcessor` + interface

No unit test (matches the codebase: processors hit EF and are verified via live testing). Aggregation resolves entity titles by direct EF lookups so the service stays uncoupled from other services.

**Files:**
- Create: `Backend/SorobanSecurityPortalApi/Data/Processors/PageViewProcessor.cs`

- [ ] **Step 1: Create the processor + interface**

```csharp
using Microsoft.EntityFrameworkCore;
using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;

namespace SorobanSecurityPortalApi.Data.Processors
{
    public class PageViewProcessor : IPageViewProcessor
    {
        private const int TopEntitiesPerType = 5;
        private const int DailySeriesDays = 30;

        private readonly IDbContextFactory<Db> _dbFactory;
        public PageViewProcessor(IDbContextFactory<Db> dbFactory) => _dbFactory = dbFactory;

        // Returns true if this visitor already has a row for this entity/source today (UTC).
        public async Task<bool> ExistsTodayAsync(EntityType entityType, int entityId, string visitorHash, PageViewSource source)
        {
            var dayStart = DateTime.UtcNow.Date;
            var dayEnd = dayStart.AddDays(1);
            await using var db = await _dbFactory.CreateDbContextAsync();
            return await db.PageView.AsNoTracking().AnyAsync(p =>
                p.EntityType == entityType &&
                p.EntityId == entityId &&
                p.Source == source &&
                p.VisitorHash == visitorHash &&
                p.ViewedAt >= dayStart && p.ViewedAt < dayEnd);
        }

        public async Task AddAsync(PageViewModel row)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            db.PageView.Add(row);
            await db.SaveChangesAsync();
        }

        // Human counts for the public per-entity counter.
        public async Task<PageViewCountViewModel> GetCountsAsync(EntityType entityType, int entityId)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var q = db.PageView.AsNoTracking().Where(p =>
                p.EntityType == entityType && p.EntityId == entityId && p.Source == PageViewSource.Human);
            var total = await q.CountAsync();
            var unique = await q.Select(p => p.VisitorHash).Distinct().CountAsync();
            return new PageViewCountViewModel { Total = total, Unique = unique };
        }

        public async Task<AnalyticsStatisticsViewModel> GetStatisticsAsync()
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var human = db.PageView.AsNoTracking().Where(p => p.Source == PageViewSource.Human);

            var result = new AnalyticsStatisticsViewModel
            {
                TotalHumanViews = await human.CountAsync(),
                UniqueVisitors = await human.Select(p => p.VisitorHash).Distinct().CountAsync(),
                CrawlerShares = await db.PageView.AsNoTracking().CountAsync(p => p.Source == PageViewSource.Crawler),
            };

            // Top human-viewed entities per type, with titles resolved from each entity table.
            foreach (var type in new[] { EntityType.Report, EntityType.Auditor, EntityType.Vulnerability, EntityType.Protocol })
            {
                var top = await human.Where(p => p.EntityType == type)
                    .GroupBy(p => p.EntityId)
                    .Select(g => new { EntityId = g.Key, Views = g.Count() })
                    .OrderByDescending(x => x.Views)
                    .Take(TopEntitiesPerType)
                    .ToListAsync();

                foreach (var t in top)
                {
                    result.TopEntities.Add(new TopEntityViewModel
                    {
                        EntityType = type,
                        EntityId = t.EntityId,
                        Views = t.Views,
                        Title = await ResolveTitleAsync(db, type, t.EntityId)
                    });
                }
            }
            result.TopEntities = result.TopEntities.OrderByDescending(t => t.Views).ToList();

            // Daily human views for the last N days.
            var since = DateTime.UtcNow.Date.AddDays(-(DailySeriesDays - 1));
            var daily = await human.Where(p => p.ViewedAt >= since)
                .GroupBy(p => p.ViewedAt.Date)
                .Select(g => new DailyViewsViewModel { Date = g.Key, Views = g.Count() })
                .OrderBy(d => d.Date)
                .ToListAsync();
            result.Daily = daily;

            return result;
        }

        private static async Task<string> ResolveTitleAsync(Db db, EntityType type, int id)
        {
            string? title = type switch
            {
                EntityType.Report => await db.Report.AsNoTracking().Where(r => r.Id == id).Select(r => r.Name).FirstOrDefaultAsync(),
                EntityType.Auditor => await db.Auditor.AsNoTracking().Where(a => a.Id == id).Select(a => a.Name).FirstOrDefaultAsync(),
                EntityType.Vulnerability => await db.Vulnerability.AsNoTracking().Where(v => v.Id == id).Select(v => v.Title).FirstOrDefaultAsync(),
                EntityType.Protocol => await db.Protocol.AsNoTracking().Where(p => p.Id == id).Select(p => p.Name).FirstOrDefaultAsync(),
                _ => null
            };
            return string.IsNullOrWhiteSpace(title) ? $"{type} #{id}" : title!;
        }
    }

    public interface IPageViewProcessor
    {
        Task<bool> ExistsTodayAsync(EntityType entityType, int entityId, string visitorHash, PageViewSource source);
        Task AddAsync(PageViewModel row);
        Task<PageViewCountViewModel> GetCountsAsync(EntityType entityType, int entityId);
        Task<AnalyticsStatisticsViewModel> GetStatisticsAsync();
    }
}
```

> NOTE during implementation: confirm `ProtocolModel` exposes `Name` (it does per the codebase). If any property name differs, adjust the `ResolveTitleAsync` selector accordingly.

- [ ] **Step 2: Build** → succeeds.

- [ ] **Step 3: Commit**

```bash
git add Backend/SorobanSecurityPortalApi/Data/Processors/PageViewProcessor.cs
git commit -m "feat(analytics): add page-view data processor with aggregation"
```

---

## Phase 4 — Service layer (TDD)

### Task 5: `PageViewService` + interface + tests

The service builds the visitor hash with `HMACSHA256` keyed by an existing server secret (do **not** add a new required Config key — `Config` validates all keys). Inject `IExtendedConfig` and use its auth signing key as the HMAC key.

**Files:**
- Create: `Backend/SorobanSecurityPortalApi/Services/ControllersServices/PageViewService.cs`
- Test: `Backend/SorobanSecurityPortalApi.Tests/Services/PageViewServiceTests.cs`

- [ ] **Step 1: Write the failing test**

```csharp
using FluentAssertions;
using Moq;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;
using SorobanSecurityPortalApi.Services.ControllersServices;
using Xunit;

namespace SorobanSecurityPortalApi.Tests.Services
{
    public class PageViewServiceTests
    {
        private readonly Mock<IPageViewProcessor> _proc = new();
        private readonly Mock<IExtendedConfig> _cfg = new();

        public PageViewServiceTests()
        {
            _cfg.SetupGet(c => c.AuthSecurityKey).Returns("test-secret-key-test-secret-key-1234567890");
        }

        private PageViewService Sut() => new(_proc.Object, _cfg.Object);

        [Fact]
        public async Task RecordView_HumanUa_RecordsHumanSource()
        {
            _proc.Setup(p => p.ExistsTodayAsync(It.IsAny<EntityType>(), It.IsAny<int>(), It.IsAny<string>(), It.IsAny<PageViewSource>()))
                 .ReturnsAsync(false);
            PageViewModel? saved = null;
            _proc.Setup(p => p.AddAsync(It.IsAny<PageViewModel>())).Callback<PageViewModel>(m => saved = m).Returns(Task.CompletedTask);

            await Sut().RecordView(EntityType.Report, 7, "203.0.113.4",
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120 Safari/537.36");

            saved.Should().NotBeNull();
            saved!.Source.Should().Be(PageViewSource.Human);
            saved.EntityType.Should().Be(EntityType.Report);
            saved.EntityId.Should().Be(7);
            saved.VisitorHash.Should().NotBeNullOrWhiteSpace();
            saved.VisitorHash.Should().NotContain("203.0.113.4"); // no raw IP stored
        }

        [Fact]
        public async Task RecordView_BotUa_RecordsCrawlerSource()
        {
            _proc.Setup(p => p.ExistsTodayAsync(It.IsAny<EntityType>(), It.IsAny<int>(), It.IsAny<string>(), It.IsAny<PageViewSource>()))
                 .ReturnsAsync(false);
            PageViewModel? saved = null;
            _proc.Setup(p => p.AddAsync(It.IsAny<PageViewModel>())).Callback<PageViewModel>(m => saved = m).Returns(Task.CompletedTask);

            await Sut().RecordView(EntityType.Report, 7, "1.2.3.4", "Twitterbot/1.0");

            saved!.Source.Should().Be(PageViewSource.Crawler);
        }

        [Fact]
        public async Task RecordView_ForcedCrawler_OverridesUa()
        {
            _proc.Setup(p => p.ExistsTodayAsync(It.IsAny<EntityType>(), It.IsAny<int>(), It.IsAny<string>(), It.IsAny<PageViewSource>()))
                 .ReturnsAsync(false);
            PageViewModel? saved = null;
            _proc.Setup(p => p.AddAsync(It.IsAny<PageViewModel>())).Callback<PageViewModel>(m => saved = m).Returns(Task.CompletedTask);

            await Sut().RecordView(EntityType.Vulnerability, 3, "1.2.3.4",
                "Mozilla/5.0 Chrome/120", PageViewSource.Crawler);

            saved!.Source.Should().Be(PageViewSource.Crawler);
        }

        [Fact]
        public async Task RecordView_Duplicate_SkipsInsert()
        {
            _proc.Setup(p => p.ExistsTodayAsync(It.IsAny<EntityType>(), It.IsAny<int>(), It.IsAny<string>(), It.IsAny<PageViewSource>()))
                 .ReturnsAsync(true);

            await Sut().RecordView(EntityType.Report, 7, "1.2.3.4", "Mozilla/5.0 Chrome/120");

            _proc.Verify(p => p.AddAsync(It.IsAny<PageViewModel>()), Times.Never);
        }

        [Fact]
        public async Task RecordView_SameInputs_ProduceSameHash()
        {
            _proc.Setup(p => p.ExistsTodayAsync(It.IsAny<EntityType>(), It.IsAny<int>(), It.IsAny<string>(), It.IsAny<PageViewSource>()))
                 .ReturnsAsync(false);
            var hashes = new List<string>();
            _proc.Setup(p => p.AddAsync(It.IsAny<PageViewModel>()))
                 .Callback<PageViewModel>(m => hashes.Add(m.VisitorHash)).Returns(Task.CompletedTask);

            await Sut().RecordView(EntityType.Report, 7, "9.9.9.9", "Mozilla/5.0 Chrome/120");
            await Sut().RecordView(EntityType.Report, 7, "9.9.9.9", "Mozilla/5.0 Chrome/120");
            await Sut().RecordView(EntityType.Report, 7, "8.8.8.8", "Mozilla/5.0 Chrome/120");

            hashes.Should().HaveCount(3);
            hashes[0].Should().Be(hashes[1]);          // same ip+ua+day → same hash
            hashes[2].Should().NotBe(hashes[0]);        // different ip → different hash
        }

        [Fact]
        public async Task GetCounts_DelegatesToProcessor()
        {
            _proc.Setup(p => p.GetCountsAsync(EntityType.Auditor, 5))
                 .ReturnsAsync(new PageViewCountViewModel { Total = 12, Unique = 9 });

            var r = await Sut().GetCounts(EntityType.Auditor, 5);

            r.Total.Should().Be(12);
            r.Unique.Should().Be(9);
        }
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `dotnet test Backend/SorobanSecurityPortalApi.Tests --filter PageViewServiceTests`
Expected: FAIL — `PageViewService` does not exist.

> If `IExtendedConfig` does not expose `AuthSecurityKey` as a `string` get-property, check `Backend/SorobanSecurityPortalApi/Common/ExtendedConfig.cs` for the actual secret property name and use that instead (update the mock setup + service to match). Any stable secret string already on `IExtendedConfig` is acceptable as the HMAC key.

- [ ] **Step 3: Implement the service**

```csharp
using System.Security.Cryptography;
using System.Text;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;

namespace SorobanSecurityPortalApi.Services.ControllersServices
{
    public interface IPageViewService
    {
        // forcedSource lets OgController record a Crawler view regardless of UA.
        Task RecordView(EntityType entityType, int entityId, string? ipAddress, string? userAgent, PageViewSource? forcedSource = null);
        Task<PageViewCountViewModel> GetCounts(EntityType entityType, int entityId);
        Task<AnalyticsStatisticsViewModel> GetStatistics();
    }

    public class PageViewService : IPageViewService
    {
        private readonly IPageViewProcessor _processor;
        private readonly IExtendedConfig _config;

        public PageViewService(IPageViewProcessor processor, IExtendedConfig config)
        {
            _processor = processor;
            _config = config;
        }

        public async Task RecordView(EntityType entityType, int entityId, string? ipAddress, string? userAgent, PageViewSource? forcedSource = null)
        {
            if (entityId <= 0) return;
            var source = forcedSource ?? (BotUserAgent.IsBot(userAgent) ? PageViewSource.Crawler : PageViewSource.Human);
            var hash = ComputeVisitorHash(ipAddress, userAgent);

            // Per-visitor/day dedupe keeps "total" meaningful while still growing day over day.
            if (await _processor.ExistsTodayAsync(entityType, entityId, hash, source))
                return;

            await _processor.AddAsync(new PageViewModel
            {
                EntityType = entityType,
                EntityId = entityId,
                ViewedAt = DateTime.UtcNow,
                VisitorHash = hash,
                Source = source
            });
        }

        public Task<PageViewCountViewModel> GetCounts(EntityType entityType, int entityId)
            => _processor.GetCountsAsync(entityType, entityId);

        public Task<AnalyticsStatisticsViewModel> GetStatistics()
            => _processor.GetStatisticsAsync();

        // HMAC-SHA256(ip + "|" + ua + "|" + yyyy-MM-dd) keyed by a server secret.
        // One-way + keyed → the raw IP cannot be recovered or brute-forced offline. No PII at rest.
        private string ComputeVisitorHash(string? ip, string? ua)
        {
            var material = $"{ip}|{ua}|{DateTime.UtcNow:yyyy-MM-dd}";
            var key = Encoding.UTF8.GetBytes(_config.AuthSecurityKey ?? "soroban-analytics-salt");
            using var hmac = new HMACSHA256(key);
            var bytes = hmac.ComputeHash(Encoding.UTF8.GetBytes(material));
            return Convert.ToHexString(bytes).ToLowerInvariant(); // 64 hex chars
        }
    }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `dotnet test Backend/SorobanSecurityPortalApi.Tests --filter PageViewServiceTests`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add Backend/SorobanSecurityPortalApi/Services/ControllersServices/PageViewService.cs Backend/SorobanSecurityPortalApi.Tests/Services/PageViewServiceTests.cs
git commit -m "feat(analytics): add page-view service (hashing, dedupe, bot classification)"
```

---

## Phase 5 — Controller (TDD)

### Task 6: `AnalyticsController` + tests

**Files:**
- Create: `Backend/SorobanSecurityPortalApi/Controllers/AnalyticsController.cs`
- Test: `Backend/SorobanSecurityPortalApi.Tests/Controllers/AnalyticsControllerTests.cs`

- [ ] **Step 1: Write the failing test**

```csharp
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using SorobanSecurityPortalApi.Controllers;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;
using SorobanSecurityPortalApi.Services.ControllersServices;
using Xunit;

namespace SorobanSecurityPortalApi.Tests.Controllers
{
    public class AnalyticsControllerTests
    {
        private readonly Mock<IPageViewService> _svc = new();

        private AnalyticsController Sut(string? xff = null, string? ua = null)
        {
            var ctrl = new AnalyticsController(_svc.Object);
            var http = new DefaultHttpContext();
            if (xff != null) http.Request.Headers["X-Forwarded-For"] = xff;
            if (ua != null) http.Request.Headers.UserAgent = ua;
            ctrl.ControllerContext = new ControllerContext { HttpContext = http };
            return ctrl;
        }

        [Fact]
        public async Task RecordView_Valid_RecordsAndReturnsOk()
        {
            var result = await Sut(xff: "203.0.113.7, 10.0.0.1", ua: "Mozilla/5.0 Chrome/120")
                .RecordView(new AnalyticsController.RecordPageViewRequest { EntityType = EntityType.Report, EntityId = 9 });

            result.Should().BeOfType<OkResult>();
            // Uses the FIRST X-Forwarded-For hop as the client IP.
            _svc.Verify(s => s.RecordView(EntityType.Report, 9, "203.0.113.7", "Mozilla/5.0 Chrome/120", null), Times.Once);
        }

        [Fact]
        public async Task RecordView_InvalidEntityId_ReturnsBadRequest()
        {
            var result = await Sut().RecordView(new AnalyticsController.RecordPageViewRequest { EntityType = EntityType.Report, EntityId = 0 });
            result.Should().BeOfType<BadRequestObjectResult>();
            _svc.Verify(s => s.RecordView(It.IsAny<EntityType>(), It.IsAny<int>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<PageViewSource?>()), Times.Never);
        }

        [Fact]
        public async Task GetCounts_Valid_ReturnsCounts()
        {
            _svc.Setup(s => s.GetCounts(EntityType.Auditor, 4))
                .ReturnsAsync(new PageViewCountViewModel { Total = 5, Unique = 3 });

            var result = await Sut().GetCounts((int)EntityType.Auditor, 4);

            var ok = result.Should().BeOfType<OkObjectResult>().Subject;
            ok.Value.Should().BeOfType<PageViewCountViewModel>()
                .Which.Total.Should().Be(5);
        }

        [Fact]
        public async Task GetCounts_InvalidType_ReturnsBadRequest()
        {
            var result = await Sut().GetCounts(99, 4);
            result.Should().BeOfType<BadRequestObjectResult>();
        }

        [Fact]
        public async Task Statistics_ReturnsServiceResult()
        {
            _svc.Setup(s => s.GetStatistics()).ReturnsAsync(new AnalyticsStatisticsViewModel { TotalHumanViews = 42 });
            var result = await Sut().Statistics();
            var ok = result.Should().BeOfType<OkObjectResult>().Subject;
            ok.Value.Should().BeOfType<AnalyticsStatisticsViewModel>().Which.TotalHumanViews.Should().Be(42);
        }
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `dotnet test Backend/SorobanSecurityPortalApi.Tests --filter AnalyticsControllerTests`
Expected: FAIL — `AnalyticsController` does not exist.

- [ ] **Step 3: Implement the controller**

```csharp
using Microsoft.AspNetCore.Mvc;
using SorobanSecurityPortalApi.Authorization.Attributes;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Services.ControllersServices;

namespace SorobanSecurityPortalApi.Controllers
{
    [ApiController]
    [Route("api/v1/analytics")]
    public class AnalyticsController : ControllerBase
    {
        private readonly IPageViewService _service;
        public AnalyticsController(IPageViewService service) => _service = service;

        public class RecordPageViewRequest
        {
            public EntityType EntityType { get; set; }
            public int EntityId { get; set; }
        }

        // Public: the SPA records a human view on page mount. Bots that don't run JS never reach this.
        [HttpPost("view")]
        public async Task<IActionResult> RecordView([FromBody] RecordPageViewRequest req)
        {
            if (req == null || req.EntityId <= 0 || !Enum.IsDefined(typeof(EntityType), req.EntityType))
                return BadRequest("Invalid entity.");

            await _service.RecordView(req.EntityType, req.EntityId, ClientIp(), UserAgent());
            return Ok();
        }

        // Public: per-entity counter for the on-page "Views" card.
        [HttpGet("view/{entityType:int}/{entityId:int}")]
        public async Task<IActionResult> GetCounts(int entityType, int entityId)
        {
            if (entityId <= 0 || !Enum.IsDefined(typeof(EntityType), entityType))
                return BadRequest("Invalid entity.");
            return Ok(await _service.GetCounts((EntityType)entityType, entityId));
        }

        // Admin/Moderator only: aggregated dashboard.
        [RoleAuthorize(Role.Admin, Role.Moderator)]
        [HttpGet("statistics")]
        public async Task<IActionResult> Statistics() => Ok(await _service.GetStatistics());

        // Behind ingress/nginx the connection IP is the proxy; the real client is the first XFF hop.
        private string? ClientIp()
        {
            var xff = Request.Headers["X-Forwarded-For"].ToString();
            if (!string.IsNullOrWhiteSpace(xff))
                return xff.Split(',')[0].Trim();
            return HttpContext.Connection.RemoteIpAddress?.ToString();
        }

        private string UserAgent() => Request.Headers.UserAgent.ToString();
    }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `dotnet test Backend/SorobanSecurityPortalApi.Tests --filter AnalyticsControllerTests`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add Backend/SorobanSecurityPortalApi/Controllers/AnalyticsController.cs Backend/SorobanSecurityPortalApi.Tests/Controllers/AnalyticsControllerTests.cs
git commit -m "feat(analytics): add AnalyticsController (public record/count, admin stats)"
```

---

## Phase 6 — OG crawler recording

### Task 7: Record a Crawler view from `OgController` (best-effort)

**Files:**
- Modify: `Backend/SorobanSecurityPortalApi/Controllers/OgController.cs`
- Modify: `Backend/SorobanSecurityPortalApi.Tests/Controllers/OgControllerTests.cs` (constructor now needs an `IPageViewService` mock)

- [ ] **Step 1: Update OgController** — add the dependency and best-effort recording.

In the field/constructor area, add the service:

```csharp
        private readonly IPageViewService _pageViewService;

        public OgController(IVulnerabilityService vulnerabilityService, IReportService reportService, Config config, IPageViewService pageViewService)
        {
            _vulnerabilityService = vulnerabilityService;
            _reportService = reportService;
            _config = config;
            _pageViewService = pageViewService;
        }
```

In `Vulnerability(int id)`, immediately before `return Page(...)` (i.e. once we've decided to serve rich tags):

```csharp
            await RecordCrawlerView(EntityType.Vulnerability, id);
```

In `Report(int id)`, immediately before `return Page(...)`:

```csharp
            await RecordCrawlerView(EntityType.Report, id);
```

Add this helper (must never throw or block the OG response):

```csharp
        // Records a crawler/link-preview hit. Best-effort: a failure here must never break the
        // OpenGraph response that social crawlers depend on.
        private async Task RecordCrawlerView(EntityType entityType, int id)
        {
            try
            {
                var xff = Request.Headers["X-Forwarded-For"].ToString();
                var ip = string.IsNullOrWhiteSpace(xff) ? HttpContext.Connection.RemoteIpAddress?.ToString() : xff.Split(',')[0].Trim();
                var ua = Request.Headers.UserAgent.ToString();
                await _pageViewService.RecordView(entityType, id, ip, ua, PageViewSource.Crawler);
            }
            catch
            {
                // swallow — analytics must not affect link previews
            }
        }
```

Add `using SorobanSecurityPortalApi.Services.ControllersServices;` if not present (it is) and ensure `EntityType` resolves (it's in `SorobanSecurityPortalApi.Models.DbModels`, already imported).

- [ ] **Step 2: Update OgController tests** — fix the `Sut()` to pass the new dependency, and add a test that recording failure doesn't break OG.

Add a field: `private readonly Mock<IPageViewService> _pageViews = new();` and change `Sut()`:

```csharp
        private OgController Sut() => new(_vuln.Object, _report.Object, _config, _pageViews.Object);
```

Add this test:

```csharp
        [Fact]
        public async Task Vulnerability_RecordingThrows_StillReturnsOgHtml()
        {
            _vuln.Setup(s => s.Get(7)).ReturnsAsync(new VulnerabilityViewModel
            { Id = 7, Title = "Reentrancy", Description = "bug", Status = "approved", Category = VulnerabilityCategory.Valid });
            _pageViews.Setup(p => p.RecordView(It.IsAny<EntityType>(), It.IsAny<int>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<PageViewSource?>()))
                      .ThrowsAsync(new Exception("db down"));

            var body = Body(await Sut().Vulnerability(7));

            body.Should().Contain("og:title");
        }
```

Ensure the test file has `using SorobanSecurityPortalApi.Models.DbModels;` (for `EntityType`/`PageViewSource`) and `using SorobanSecurityPortalApi.Services.ControllersServices;`. The `Sut()` will need an `HttpContext`; if existing OG tests construct the controller without one, add in `Sut()`:

```csharp
            var ctrl = new OgController(_vuln.Object, _report.Object, _config, _pageViews.Object);
            ctrl.ControllerContext = new Microsoft.AspNetCore.Mvc.ControllerContext { HttpContext = new Microsoft.AspNetCore.Http.DefaultHttpContext() };
            return ctrl;
```
(only if the existing `Sut()` did not already set a context — keep its existing shape otherwise and just add the 4th arg).

- [ ] **Step 3: Run the OG tests**

Run: `dotnet test Backend/SorobanSecurityPortalApi.Tests --filter OgControllerTests`
Expected: PASS (existing tests + the new one).

- [ ] **Step 4: Run the full backend suite**

Run: `dotnet test Backend/SorobanSecurityPortalApi.Tests`
Expected: PASS (all green).

- [ ] **Step 5: Commit**

```bash
git add Backend/SorobanSecurityPortalApi/Controllers/OgController.cs Backend/SorobanSecurityPortalApi.Tests/Controllers/OgControllerTests.cs
git commit -m "feat(analytics): record crawler/link-preview hits from OgController"
```

---

## Phase 7 — Migration & version bump

### Task 8: Generate the additive migration + bump ProductVersion

**Files:**
- Create (generated): `Backend/SorobanSecurityPortalApi/Migrations/<timestamp>_AddPageViewAnalytics.cs` + `.Designer.cs` + updated `DbModelSnapshot.cs`
- Modify: `Backend/SorobanSecurityPortalApi/appsettings.json` (`ProductVersion`)

- [ ] **Step 1: Ensure EF tools are available**

Run: `dotnet ef --version`
If missing: `dotnet tool install --global dotnet-ef` (then reopen shell so PATH picks it up), or use `dotnet tool restore` if a tool manifest exists.

- [ ] **Step 2: Generate the migration** (run from the API project dir)

Run:
```bash
dotnet ef migrations add AddPageViewAnalytics --project Backend/SorobanSecurityPortalApi/SorobanSecurityPortalApi.csproj
```
Expected: creates the migration **with** a `.Designer.cs` and updates `DbModelSnapshot.cs`. Open the generated `*_AddPageViewAnalytics.cs` and confirm `Up()` only `CreateTable("page_view", ...)` + `CreateIndex(...)` and `Down()` drops it. **Verify all three files exist** (the `.cs`, `.Designer.cs`, and the snapshot diff) — the missing-Designer defect from #115/#129/#134 must not recur.

- [ ] **Step 3: Bump ProductVersion** in `appsettings.json` from `"1.23"` to `"1.24"` so the runtime migration runner applies the new migration on deploy:

```json
	"ProductVersion": "1.24",
```

> During deploy (Phase 10) verify dev's live ProductVersion; if it is ≥ 1.24, bump this higher so `config.ProductVersion != db version` and the migration runs.

- [ ] **Step 4: Build + full backend tests**

Run: `dotnet build Backend/SorobanSecurityPortalApi/SorobanSecurityPortalApi.csproj` then `dotnet test Backend/SorobanSecurityPortalApi.Tests`
Expected: build succeeds; all tests pass.

- [ ] **Step 5: Commit**

```bash
git add Backend/SorobanSecurityPortalApi/Migrations/ Backend/SorobanSecurityPortalApi/appsettings.json
git commit -m "feat(analytics): EF migration for page_view + bump ProductVersion to 1.24"
```

---

## Phase 8 — UI: API client & types

### Task 9: Analytics models + API calls

**Files:**
- Create: `UI/src/api/soroban-security-portal/models/analytics.ts`
- Modify: `UI/src/api/soroban-security-portal/soroban-security-portal-api.ts` (add an `// --- ANALYTICS ---` block near the end, before `getRestClient`)

> CASING NOTE: confirm the API's JSON casing before finalizing field names. Existing TS models are camelCase (e.g. `report.id`), so the backend already serializes camelCase — keep these interfaces camelCase. If a quick check of `Startup.cs`'s `AddNewtonsoftJson` shows PascalCase, switch the interface fields to PascalCase to match. (Verify against a real response in Phase 10.)

- [ ] **Step 1: Create the models**

```typescript
// Mirrors the backend EntityType enum (Protocol=0, Auditor=1, Vulnerability=2, Report=3).
export enum PageViewEntityType {
  Protocol = 0,
  Auditor = 1,
  Vulnerability = 2,
  Report = 3,
}

export interface PageViewCount {
  total: number;
  unique: number;
}

export interface AnalyticsTopEntity {
  entityType: PageViewEntityType;
  entityId: number;
  title: string;
  views: number;
}

export interface AnalyticsDailyViews {
  date: string;
  views: number;
}

export interface AnalyticsStatistics {
  totalHumanViews: number;
  uniqueVisitors: number;
  crawlerShares: number;
  topEntities: AnalyticsTopEntity[];
  daily: AnalyticsDailyViews[];
}
```

- [ ] **Step 2: Add the API calls** (append an analytics section just before `const getRestClient = ...`):

```typescript
// --- ANALYTICS ---
import { PageViewEntityType, PageViewCount, AnalyticsStatistics } from './models/analytics';

export const recordPageViewCall = async (entityType: PageViewEntityType, entityId: number): Promise<void> => {
    const client = await getRestClient();
    // ignoreError=true: a failed view-record must never surface an error to the visitor.
    await client.request('api/v1/analytics/view', 'POST', { entityType, entityId }, true);
};

export const getPageViewCountCall = async (entityType: PageViewEntityType, entityId: number): Promise<PageViewCount> => {
    const client = await getRestClient();
    const response = await client.request(`api/v1/analytics/view/${entityType}/${entityId}`, 'GET', undefined, true);
    return response.data as PageViewCount;
};

export const getAnalyticsStatisticsCall = async (): Promise<AnalyticsStatistics> => {
    const client = await getRestClient();
    const response = await client.request('api/v1/analytics/statistics', 'GET');
    return response.data as AnalyticsStatistics;
};
```

> The `import` is added at the top of the file with the other imports rather than mid-file if the bundler complains; either works in TS/Vite, but prefer placing it in the import block at the top for cleanliness.

> Verify `getRestClient()` works for anonymous users (no auth token) — the record/count endpoints are public. Read `getRestClient` (~line 664) to confirm it tolerates an empty token; if it requires a logged-in user, use a plain `axios`/`RestApi` instance with an empty token for these two public calls.

- [ ] **Step 3: Type-check**

Run: `cd UI && npx tsc --noEmit`
Expected: no new errors from these files.

- [ ] **Step 4: Commit**

```bash
git add UI/src/api/soroban-security-portal/models/analytics.ts UI/src/api/soroban-security-portal/soroban-security-portal-api.ts
git commit -m "feat(analytics): UI api client + types for page views"
```

---

### Task 10: `usePageViewTracking` hook + test

**Files:**
- Create: `UI/src/hooks/usePageViewTracking.ts`
- Test: `UI/src/hooks/__tests__/usePageViewTracking.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { usePageViewTracking } from '../usePageViewTracking';
import { PageViewEntityType } from '../../api/soroban-security-portal/models/analytics';
import * as api from '../../api/soroban-security-portal/soroban-security-portal-api';

vi.mock('../../api/soroban-security-portal/soroban-security-portal-api', () => ({
  recordPageViewCall: vi.fn(),
  getPageViewCountCall: vi.fn(),
}));

describe('usePageViewTracking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.recordPageViewCall as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (api.getPageViewCountCall as ReturnType<typeof vi.fn>).mockResolvedValue({ total: 11, unique: 7 });
  });

  it('records once and returns the count', async () => {
    const { result } = renderHook(() => usePageViewTracking(PageViewEntityType.Report, 9));
    await waitFor(() => expect(result.current).toEqual({ total: 11, unique: 7 }));
    expect(api.recordPageViewCall).toHaveBeenCalledTimes(1);
    expect(api.recordPageViewCall).toHaveBeenCalledWith(PageViewEntityType.Report, 9);
  });

  it('does nothing for an undefined id', async () => {
    renderHook(() => usePageViewTracking(PageViewEntityType.Report, undefined));
    expect(api.recordPageViewCall).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd UI && npx vitest run src/hooks/__tests__/usePageViewTracking.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the hook**

```typescript
import { useEffect, useRef, useState } from 'react';
import { PageViewEntityType, PageViewCount } from '../api/soroban-security-portal/models/analytics';
import { recordPageViewCall, getPageViewCountCall } from '../api/soroban-security-portal/soroban-security-portal-api';

// Records a human page view once on mount and returns the public counts.
// Recording is fire-and-forget; bots that don't run JS never trigger it.
export const usePageViewTracking = (entityType: PageViewEntityType, entityId: number | undefined): PageViewCount | null => {
  const [count, setCount] = useState<PageViewCount | null>(null);
  const recordedFor = useRef<number | null>(null);

  useEffect(() => {
    if (!entityId || entityId <= 0) return;
    if (recordedFor.current === entityId) return; // guard double-fire (e.g. StrictMode / re-render)
    recordedFor.current = entityId;

    const run = async () => {
      try {
        await recordPageViewCall(entityType, entityId);
      } catch {
        /* non-blocking */
      }
      try {
        const c = await getPageViewCountCall(entityType, entityId);
        setCount(c);
      } catch {
        /* ignore */
      }
    };
    void run();
  }, [entityType, entityId]);

  return count;
};
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd UI && npx vitest run src/hooks/__tests__/usePageViewTracking.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add UI/src/hooks/usePageViewTracking.ts UI/src/hooks/__tests__/usePageViewTracking.test.tsx
git commit -m "feat(analytics): usePageViewTracking hook"
```

---

## Phase 9 — UI: public Views counters

### Task 11: Add a "Views" stat card to the four detail pages

For each page: import the hook + a `Visibility` icon, call the hook with the right `PageViewEntityType` and the entity id, and add a card object to that page's `statsCards` array. The card object to add (adjust the `value`/`tooltip` variable names to the page's local `views` variable):

```tsx
{
  icon: <VisibilityIcon sx={{ fontSize: 40 }} />,
  iconColor: SeverityColors['note'],
  value: views?.total ?? 0,
  label: 'Views',
  tooltip: views ? `${views.unique} unique visitor${views.unique === 1 ? '' : 's'}` : 'Human page views (bots excluded)',
},
```

Common imports to add to each page:
```tsx
import VisibilityIcon from '@mui/icons-material/Visibility';
import { usePageViewTracking } from '../../../../hooks/usePageViewTracking';
import { PageViewEntityType } from '../../../../api/soroban-security-portal/models/analytics';
```
(adjust the relative depth `../../../../` so it resolves to `UI/src/hooks` and `UI/src/api/...` from each page's folder.)

- [ ] **Step 1: Report page** — `UI/src/features/pages/regular/report-details/report-details.tsx`
  - Add the imports. After the existing hook destructure, add: `const views = usePageViewTracking(PageViewEntityType.Report, report?.id);`
  - Insert the Views card object into the `statsCards` array (near line 175-201).

- [ ] **Step 2: Auditor page** — `UI/src/features/pages/regular/auditor-details/auditor-details.tsx`
  - Read the file; find the `statsCards`/`StatisticsCards` usage. Add imports; add `const views = usePageViewTracking(PageViewEntityType.Auditor, auditor?.id);` (use the page's actual entity variable name). Insert the Views card.

- [ ] **Step 3: Protocol page** — `UI/src/features/pages/regular/protocol-details/protocol-details.tsx`
  - Same approach with `PageViewEntityType.Protocol` and the protocol's id variable.

- [ ] **Step 4: Vulnerability page** — `UI/src/features/pages/regular/vulnerability-details/vulnerability-details.tsx`
  - Read the file. If it uses `StatisticsCards`, add a Views card as above with `PageViewEntityType.Vulnerability`. **If it has no `StatisticsCards`**, call the hook and render a compact inline element near the header instead:

```tsx
import VisibilityIcon from '@mui/icons-material/Visibility';
// ...
<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
  <VisibilityIcon fontSize="small" />
  <Typography variant="body2">{views?.total ?? 0} views</Typography>
</Box>
```

- [ ] **Step 5: Type-check + run UI tests**

Run: `cd UI && npx tsc --noEmit && npx vitest run`
Expected: no type errors; existing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add UI/src/features/pages/regular/report-details/report-details.tsx UI/src/features/pages/regular/auditor-details/auditor-details.tsx UI/src/features/pages/regular/protocol-details/protocol-details.tsx UI/src/features/pages/regular/vulnerability-details/vulnerability-details.tsx
git commit -m "feat(analytics): show public Views counter on detail pages"
```

---

## Phase 10 — UI: Admin Statistics page

### Task 12: Statistics page + hook + route + menu

**Files:**
- Create: `UI/src/features/pages/admin/statistics/statistics.tsx`
- Create: `UI/src/features/pages/admin/statistics/hooks/useStatistics.ts`
- Modify: `UI/src/features/pages/admin/admin-main-window/admin-main-window.tsx` (import + route)
- Modify: `UI/src/features/pages/admin/left-menu/admin-left-menu.tsx` (menu item)

- [ ] **Step 1: Create the hook**

```typescript
import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { setCurrentPage } from '../../admin-main-window/current-page-slice';
import { getAnalyticsStatisticsCall } from '../../../../../api/soroban-security-portal/soroban-security-portal-api';
import { AnalyticsStatistics } from '../../../../../api/soroban-security-portal/models/analytics';

export const useStatistics = () => {
  const dispatch = useDispatch();
  const [stats, setStats] = useState<AnalyticsStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    dispatch(setCurrentPage({ pageName: 'Statistics', pageCode: 'statistics', pageUrl: window.location.pathname, routePath: 'statistics' }));
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        setStats(await getAnalyticsStatisticsCall());
      } catch {
        setError('Failed to load statistics');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [dispatch]);

  return { stats, loading, error };
};
```

- [ ] **Step 2: Create the page**

```tsx
import { FC } from 'react';
import { Box, Paper, Typography, CircularProgress, Table, TableBody, TableCell, TableHead, TableRow, Link } from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import PeopleIcon from '@mui/icons-material/People';
import ShareIcon from '@mui/icons-material/Share';
import { LineChart } from '@mui/x-charts/LineChart';
import { useStatistics } from './hooks/useStatistics';
import { StatisticsCards } from '../../../../components/details';
import { SeverityColors } from '../../../../contexts/ThemeContext';
import { PageViewEntityType } from '../../../../api/soroban-security-portal/models/analytics';

const typePath: Record<PageViewEntityType, string> = {
  [PageViewEntityType.Report]: 'reports',
  [PageViewEntityType.Auditor]: 'auditor',
  [PageViewEntityType.Vulnerability]: 'vulnerabilities',
  [PageViewEntityType.Protocol]: 'protocol',
};
const typeLabel: Record<PageViewEntityType, string> = {
  [PageViewEntityType.Report]: 'Report',
  [PageViewEntityType.Auditor]: 'Auditor',
  [PageViewEntityType.Vulnerability]: 'Vulnerability',
  [PageViewEntityType.Protocol]: 'Protocol',
};

export const Statistics: FC = () => {
  const { stats, loading, error } = useStatistics();

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;
  if (error) return <Typography color="error" sx={{ p: 2 }}>{error}</Typography>;
  if (!stats) return null;

  const cards = [
    { icon: <VisibilityIcon sx={{ fontSize: 40 }} />, iconColor: SeverityColors['note'], value: stats.totalHumanViews, label: 'Total Views' },
    { icon: <PeopleIcon sx={{ fontSize: 40 }} />, iconColor: SeverityColors['low'], value: stats.uniqueVisitors, label: 'Unique Visitors' },
    { icon: <ShareIcon sx={{ fontSize: 40 }} />, iconColor: SeverityColors['medium'], value: stats.crawlerShares, label: 'Link-Preview Shares', tooltip: 'Times a link to this site was unfurled by a social/crawler bot' },
  ];

  const xLabels = stats.daily.map((d) => d.date.substring(5, 10)); // MM-DD
  const series = stats.daily.map((d) => d.views);

  return (
    <Box sx={{ p: { xs: 1, md: 2 } }}>
      <StatisticsCards cards={cards} columns={{ xs: 12, sm: 4, md: 4 }} />

      <Paper sx={{ p: 2, mt: 3 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>Views over the last 30 days</Typography>
        {series.length > 0 ? (
          <LineChart height={280} xAxis={[{ scaleType: 'point', data: xLabels }]} series={[{ data: series, label: 'Human views', color: SeverityColors['note'] }]} />
        ) : (
          <Typography color="text.secondary">No views recorded yet.</Typography>
        )}
      </Paper>

      <Paper sx={{ p: 2, mt: 3 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>Most viewed content</Typography>
        <Table size="small">
          <TableHead>
            <TableRow><TableCell>Type</TableCell><TableCell>Title</TableCell><TableCell align="right">Views</TableCell></TableRow>
          </TableHead>
          <TableBody>
            {stats.topEntities.map((e) => (
              <TableRow key={`${e.entityType}-${e.entityId}`}>
                <TableCell>{typeLabel[e.entityType]}</TableCell>
                <TableCell><Link href={`/${typePath[e.entityType]}/${e.entityId}`} target="_blank" rel="noopener">{e.title}</Link></TableCell>
                <TableCell align="right">{e.views}</TableCell>
              </TableRow>
            ))}
            {stats.topEntities.length === 0 && (
              <TableRow><TableCell colSpan={3}>No data yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
};
```

> Verify the report detail route prefix used elsewhere: report links in the app are `/reports/:id` (plural) per the public router, while auditor/protocol are singular (`/auditor/:id`, `/protocol/:id`) and vulnerabilities is `/vulnerabilities/:id`. The `typePath` map above reflects that — double-check against `main-window.tsx` when implementing and fix any mismatch.

- [ ] **Step 3: Add the route** in `admin-main-window.tsx`:
  - Import near the other admin imports: `import { Statistics } from '../statistics/statistics.tsx';`
  - Add a route just before the moderation route:
```tsx
          <Route path={`${environment.basePath}/admin/statistics`} element={<Statistics />} />
```

- [ ] **Step 4: Add the menu item** in `admin-left-menu.tsx`:
  - Import the icon: `import QueryStatsIcon from '@mui/icons-material/QueryStats';`
  - Add an entry to `menuStructure` (e.g. right after the Moderation item):
```tsx
    {
      label: 'Statistics',
      icon: <QueryStatsIcon />,
      path: 'admin/statistics',
      visible: isAdminOrModerator(auth),
    },
```

- [ ] **Step 5: Type-check + tests**

Run: `cd UI && npx tsc --noEmit && npx vitest run`
Expected: no type errors; tests pass.

- [ ] **Step 6: Commit**

```bash
git add UI/src/features/pages/admin/statistics/ UI/src/features/pages/admin/admin-main-window/admin-main-window.tsx UI/src/features/pages/admin/left-menu/admin-left-menu.tsx
git commit -m "feat(analytics): admin Statistics page (cards, trend chart, top content)"
```

---

### Task 13: Statistics page render test

**Files:**
- Test: `UI/src/features/pages/admin/statistics/__tests__/statistics.test.tsx`

- [ ] **Step 1: Write the test**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { MemoryRouter } from 'react-router-dom';
import currentPageReducer from '../../admin-main-window/current-page-slice';
import { Statistics } from '../statistics';
import * as api from '../../../../../api/soroban-security-portal/soroban-security-portal-api';

vi.mock('../../../../../api/soroban-security-portal/soroban-security-portal-api', () => ({
  getAnalyticsStatisticsCall: vi.fn(),
}));

const renderPage = () => {
  const store = configureStore({ reducer: { currentPage: currentPageReducer } });
  return render(
    <Provider store={store}>
      <MemoryRouter>
        <ThemeProvider theme={createTheme()}>
          <Statistics />
        </ThemeProvider>
      </MemoryRouter>
    </Provider>
  );
};

describe('Statistics page', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders cards and top content from the API', async () => {
    (api.getAnalyticsStatisticsCall as ReturnType<typeof vi.fn>).mockResolvedValue({
      totalHumanViews: 100, uniqueVisitors: 60, crawlerShares: 8,
      topEntities: [{ entityType: 3, entityId: 1, title: 'Acme Audit', views: 40 }],
      daily: [{ date: '2026-05-26', views: 10 }, { date: '2026-05-27', views: 20 }],
    });

    renderPage();

    await waitFor(() => expect(screen.getByText('Acme Audit')).toBeInTheDocument());
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('Unique Visitors')).toBeInTheDocument();
    expect(screen.getByText('Link-Preview Shares')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run**

Run: `cd UI && npx vitest run src/features/pages/admin/statistics/__tests__/statistics.test.tsx`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add UI/src/features/pages/admin/statistics/__tests__/statistics.test.tsx
git commit -m "test(analytics): admin Statistics page render test"
```

---

## Phase 11 — Build, deploy to dev, verify

### Task 14: Build & push images (no CI/CD)

- [ ] **Step 1: Locate Dockerfiles** for API and UI (e.g. `Backend/.../Dockerfile`, `UI/Dockerfile`). Read `Deploy/helm` values to confirm image repo names map to `andreykerchin/soroban-security-portal` (API) and `andreykerchin/soroban-security-portal-ui` (UI).

- [ ] **Step 2: Docker login**

Run: `echo <DOCKER_PAT> | docker login -u andreykerchin --password-stdin`
Expected: Login Succeeded.

- [ ] **Step 3: Build + push both images** tagged `issues171` (use the actual Dockerfile paths/build contexts found in Step 1):

```bash
docker build -t andreykerchin/soroban-security-portal:issues171 -f <api-dockerfile> <api-context>
docker push andreykerchin/soroban-security-portal:issues171
docker build -t andreykerchin/soroban-security-portal-ui:issues171 -f <ui-dockerfile> <ui-context>
docker push andreykerchin/soroban-security-portal-ui:issues171
```
Expected: both pushes succeed. Do **not** trigger any pipeline.

### Task 15: Deploy to dev & verify migration

- [ ] **Step 1: Check dev's live ProductVersion** (via the deployed API settings or DB) using `kubeconfig.temp`. If dev ≥ 1.24, bump `appsettings.json` higher, rebuild/push, and re-tag.

- [ ] **Step 2: Helm upgrade** (single tag drives both API + UI per the chart):

```bash
KUBECONFIG=./kubeconfig.temp helm upgrade sorobansecurityportal Deploy/helm -n sorobansecurityportal-ns --reuse-values --set global.sorobansecurityportal.service.tag=issues171
```
Expected: release upgraded.

- [ ] **Step 3: Watch the API pod roll out and confirm the migration ran** (look for "Database migration completed" and no errors):

```bash
KUBECONFIG=./kubeconfig.temp kubectl -n sorobansecurityportal-ns rollout status deploy -l app.kubernetes.io/instance=sorobansecurityportal
KUBECONFIG=./kubeconfig.temp kubectl -n sorobansecurityportal-ns logs deploy/<api-deploy> | grep -i migrat
```

- [ ] **Step 4: Confirm the `page_view` table exists** (psql via the DB pod, or an API smoke call). Record the result.

### Task 16: API smoke tests on dev

- [ ] **Step 1: Record + read a view** (confirms public endpoints + camelCase casing):
```bash
curl -s -X POST https://sorobanshield.ru/api/v1/analytics/view -H 'Content-Type: application/json' -d '{"entityType":3,"entityId":1}'
curl -s https://sorobanshield.ru/api/v1/analytics/view/3/1
```
Expected: POST → 200; GET → `{"total":1,"unique":1}` (or higher). Confirm JSON keys are camelCase (`total`/`unique`).

- [ ] **Step 2: Bot UA is excluded from human counts:**
```bash
curl -s -X POST https://sorobanshield.ru/api/v1/analytics/view -H 'Content-Type: application/json' -H 'User-Agent: Twitterbot/1.0' -d '{"entityType":3,"entityId":1}'
curl -s https://sorobanshield.ru/api/v1/analytics/view/3/1
```
Expected: human `total` unchanged from Step 1.

- [ ] **Step 3: Admin endpoint is gated:**
```bash
curl -s -o /dev/null -w "%{http_code}\n" https://sorobanshield.ru/api/v1/analytics/statistics
```
Expected: `401`.

- [ ] **Step 4: Crawler/OG path records a share:** request the OG endpoint with a crawler UA, then re-check stats (after admin auth) to see `crawlerShares` increment. (OG route: a crawler UA on `/report/{id}` is rewritten by nginx to the OG backend.)
```bash
curl -s -H 'User-Agent: Twitterbot/1.0' https://sorobanshield.ru/report/1 -o /dev/null -w "%{http_code}\n"
```
Expected: 200 and an OG html body (verify with a separate `-i` call that `og:title` is present).

### Task 17: Playwright e2e (non-headless) on dev

**Files:**
- Create: `UI/e2e/visitor-analytics.spec.ts` (or the repo's existing Playwright test dir — check `UI/playwright.config.*`).

- [ ] **Step 1: Write a non-headless spec** covering happy path + edge cases. Use the webapp-testing skill's Playwright tooling or the repo's Playwright. Run with `--headed`. Cover:
  - Open `https://sorobanshield.ru/reports/1` (and an auditor, protocol, vulnerability page) → a "Views" card/element is visible with a number.
  - Reload the report page twice → the **unique** tooltip count stays stable while **total** does not exceed +1 per day (dedupe works).
  - Log in as `admin@sorobansecurity.com` (password via the documented decrypt step) → navigate to Admin → **Statistics** → cards, trend chart and "Most viewed content" table render with data.
  - Screenshot each key state into `docs/` (for the PR comment).

- [ ] **Step 2: Run headed**

Run: `cd UI && npx playwright test e2e/visitor-analytics.spec.ts --headed`
Expected: all assertions pass; screenshots saved.

> Do not commit secrets or the admin password into the spec; read it from an env var at runtime.

### Task 18: Final verification & PR

- [ ] **Step 1:** Run the full backend + UI suites once more; confirm green.
- [ ] **Step 2:** Push the branch and open a PR to `main`. Ensure no merge conflicts (rebase on `origin/main` if needed).
- [ ] **Step 3:** Resolve any review threads; ensure 0 unresolved comments before finishing.
- [ ] **Step 4:** Post the human-voice PR summary comment (product overview, what/why of any fixes, testing process + screenshots of happy path & edge cases, link to issue #171 and related discussion). No mention of tooling/agents.

---

## Notes / risks

- **Additive only:** the migration creates one table; it applies cleanly on top of dev's further-ahead schema. Extra `__EFMigrationsHistory` rows from other branches are ignored by EF.
- **Privacy:** never store raw IP; HMAC-SHA256 keyed by a server secret. No new required Config key (Config validates all keys).
- **OG safety:** crawler recording is best-effort/try-catch and must never break link previews.
- **Casing:** verify the API JSON casing (camelCase) against a live response before relying on the TS interfaces.
- **No pipelines:** all deploys are manual `docker build/push` + `helm upgrade` via `kubeconfig.temp`.

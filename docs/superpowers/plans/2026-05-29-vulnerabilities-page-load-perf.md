# Vulnerabilities Page Load Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut Vulnerabilities-page load time on weak production hardware by caching lookup endpoints in memory, returning the search total in the same request, and dropping inline image bytes from bulk list responses.

**Architecture:** A small `ILookupCache` (over `IMemoryCache`) gives read-heavy lookup service methods a cache-aside path (TTL + invalidate-on-write). The vulnerability search controller returns its total via an `X-Total-Count` header so the UI makes one request instead of two. Protocol/Company/Auditor `List()` responses null out their image bytes (already served by `/{id}/image.png`).

**Tech Stack:** ASP.NET Core (net10.0), `Microsoft.Extensions.Caching.Memory`, EF Core, AutoMapper, xUnit + FluentAssertions + Moq; React/TS + axios.

**Spec:** `docs/superpowers/specs/2026-05-29-vulnerabilities-page-load-perf-design.md`

---

## File Structure

- **Create** `Backend/SorobanSecurityPortalApi/Common/Caching/LookupCache.cs` — `ILookupCache` + `LookupCache` + `LookupCacheKeys` constants.
- **Create** `Backend/SorobanSecurityPortalApi.Tests/Common/Caching/LookupCacheTests.cs`.
- **Modify** `Backend/SorobanSecurityPortalApi/Startup.cs` — `AddMemoryCache()` + register `ILookupCache` singleton before the convention scan.
- **Modify** `ProtocolService.cs`, `CompanyService.cs`, `AuditorService.cs` — cache + slim `List()`, invalidate on write.
- **Modify** `CategoryService.cs` (tags), `VulnerabilitiesService.cs` (sources + `SearchWithTotal`), `ReportService.cs` (`GetList` cache + invalidate on write).
- **Modify** `Controllers/VulnerabilitiesController.cs` — `Search` sets `X-Total-Count`.
- **Create/Modify** backend tests under `Backend/SorobanSecurityPortalApi.Tests/Services/` and `.../Controllers/`.
- **Modify** `UI/src/api/soroban-security-portal/soroban-security-portal-api.ts` — add `getVulnerabilitiesWithTotalCall`.
- **Modify** `UI/src/features/pages/regular/vulnerabilities/hooks/vulnerabilities.hook.ts` — one call, read total.
- **Create** `UI/src/api/soroban-security-portal/__tests__/vulnerabilities-total-header.test.ts`.

**Commands** (repo root `C:/Projects/My/soroban-security-portal`):
- Backend build: `dotnet build Backend/SorobanSecurityPortalApi/SorobanSecurityPortalApi.csproj`
- Backend tests: `dotnet test Backend/SorobanSecurityPortalApi.Tests/SorobanSecurityPortalApi.Tests.csproj`
- Single backend test: `... --filter "FullyQualifiedName~LookupCacheTests"`
- UI tests: `cd UI; npm test -- --run <file>` (Vitest)

---

## Task 1: `ILookupCache` helper + DI

**Files:**
- Create: `Backend/SorobanSecurityPortalApi/Common/Caching/LookupCache.cs`
- Test: `Backend/SorobanSecurityPortalApi.Tests/Common/Caching/LookupCacheTests.cs`
- Modify: `Backend/SorobanSecurityPortalApi/Startup.cs`

- [ ] **Step 1: Write the failing test**

Create `Backend/SorobanSecurityPortalApi.Tests/Common/Caching/LookupCacheTests.cs`:

```csharp
using Microsoft.Extensions.Caching.Memory;
using SorobanSecurityPortalApi.Common.Caching;
using Xunit;

namespace SorobanSecurityPortalApi.Tests.Common.Caching
{
    public class LookupCacheTests
    {
        private static LookupCache Create() =>
            new(new MemoryCache(new MemoryCacheOptions()));

        [Fact]
        public async Task GetOrCreateAsync_RunsFactoryOnce_ThenServesFromCache()
        {
            var cache = Create();
            var calls = 0;
            Func<Task<int>> factory = () => { calls++; return Task.FromResult(42); };

            var a = await cache.GetOrCreateAsync("k", factory);
            var b = await cache.GetOrCreateAsync("k", factory);

            a.Should().Be(42);
            b.Should().Be(42);
            calls.Should().Be(1); // second call served from cache
        }

        [Fact]
        public async Task Remove_ForcesFactoryToRunAgain()
        {
            var cache = Create();
            var calls = 0;
            Func<Task<int>> factory = () => { calls++; return Task.FromResult(calls); };

            await cache.GetOrCreateAsync("k", factory);
            cache.Remove("k");
            var afterRemove = await cache.GetOrCreateAsync("k", factory);

            calls.Should().Be(2);
            afterRemove.Should().Be(2);
        }

        [Fact]
        public async Task GetOrCreateAsync_DoesNotCacheWhenFactoryThrows()
        {
            var cache = Create();
            Func<Task<int>> bad = () => throw new InvalidOperationException("boom");

            await Assert.ThrowsAsync<InvalidOperationException>(() => cache.GetOrCreateAsync("k", bad));
            // a subsequent good call must run the factory (nothing was cached)
            var ok = await cache.GetOrCreateAsync("k", () => Task.FromResult(7));
            ok.Should().Be(7);
        }
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `dotnet test Backend/SorobanSecurityPortalApi.Tests/SorobanSecurityPortalApi.Tests.csproj --filter "FullyQualifiedName~LookupCacheTests"`
Expected: FAIL — `LookupCache` does not exist.

- [ ] **Step 3: Write the implementation**

Create `Backend/SorobanSecurityPortalApi/Common/Caching/LookupCache.cs`:

```csharp
using Microsoft.Extensions.Caching.Memory;

namespace SorobanSecurityPortalApi.Common.Caching
{
    // Stable cache keys for the read-heavy, rarely-changing lookup lists used by list/filter UIs.
    public static class LookupCacheKeys
    {
        public const string Protocols = "lookup:protocols";
        public const string Companies = "lookup:companies";
        public const string Auditors = "lookup:auditors";
        public const string Tags = "lookup:tags";
        public const string Sources = "lookup:sources";
        public const string Reports = "lookup:reports";
    }

    // Thin cache-aside wrapper over IMemoryCache for lookup data. Default TTL is a backstop;
    // callers also evict explicitly on write. A throwing factory caches nothing.
    public interface ILookupCache
    {
        Task<T> GetOrCreateAsync<T>(string key, Func<Task<T>> factory, TimeSpan? ttl = null);
        void Remove(string key);
    }

    public class LookupCache : ILookupCache
    {
        private static readonly TimeSpan DefaultTtl = TimeSpan.FromMinutes(10);
        private readonly IMemoryCache _cache;

        public LookupCache(IMemoryCache cache) => _cache = cache;

        public async Task<T> GetOrCreateAsync<T>(string key, Func<Task<T>> factory, TimeSpan? ttl = null)
        {
            if (_cache.TryGetValue(key, out T cached))
                return cached;
            var value = await factory();
            _cache.Set(key, value, new MemoryCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = ttl ?? DefaultTtl
            });
            return value;
        }

        public void Remove(string key) => _cache.Remove(key);
    }
}
```

- [ ] **Step 4: Register in DI**

In `Backend/SorobanSecurityPortalApi/Startup.cs`, immediately after `services.AddSingleton(_config);` (line ~44, before the `ForInterfacesMatching` convention scans so the scan skips `ILookupCache`), add:

```csharp
        services.AddMemoryCache();
        services.AddSingleton<SorobanSecurityPortalApi.Common.Caching.ILookupCache,
                              SorobanSecurityPortalApi.Common.Caching.LookupCache>();
```

- [ ] **Step 5: Run test + build**

Run: `dotnet test Backend/SorobanSecurityPortalApi.Tests/SorobanSecurityPortalApi.Tests.csproj --filter "FullyQualifiedName~LookupCacheTests"`
Expected: PASS (3 tests).
Run: `dotnet build Backend/SorobanSecurityPortalApi/SorobanSecurityPortalApi.csproj`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add Backend/SorobanSecurityPortalApi/Common/Caching/LookupCache.cs Backend/SorobanSecurityPortalApi.Tests/Common/Caching/LookupCacheTests.cs Backend/SorobanSecurityPortalApi/Startup.cs
git commit -m "Add ILookupCache (in-memory cache-aside) + DI registration"
```
(Footer line on every commit: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.)

---

## Task 2: Cache + slim ProtocolService.List

**Files:**
- Modify: `Backend/SorobanSecurityPortalApi/Services/ControllersServices/ProtocolService.cs`
- Test: `Backend/SorobanSecurityPortalApi.Tests/Services/ProtocolServiceCacheTests.cs`

- [ ] **Step 1: Write the failing test**

Create `Backend/SorobanSecurityPortalApi.Tests/Services/ProtocolServiceCacheTests.cs`:

```csharp
using AutoMapper;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Caching.Memory;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Common.Caching;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;
using SorobanSecurityPortalApi.Services.ControllersServices;
using Xunit;

namespace SorobanSecurityPortalApi.Tests.Services
{
    public class ProtocolServiceCacheTests
    {
        private static UserContextAccessor UserCtx() =>
            new(Mock.Of<IHttpContextAccessor>(), Mock.Of<ILoginProcessor>());

        private static (ProtocolService svc, Mock<IProtocolProcessor> proc, LookupCache cache) Build()
        {
            var proc = new Mock<IProtocolProcessor>();
            var mapper = new Mock<IMapper>();
            // mapper returns one protocol WITH image bytes so we can assert it gets nulled
            mapper.Setup(m => m.Map<List<ProtocolViewModel>>(It.IsAny<object>()))
                  .Returns(() => new List<ProtocolViewModel>
                  {
                      new ProtocolViewModel { Id = 1, Name = "P", ImageData = new byte[] { 1, 2, 3 } }
                  });
            var cache = new LookupCache(new MemoryCache(new MemoryCacheOptions()));
            var svc = new ProtocolService(mapper.Object, proc.Object, UserCtx(), cache);
            return (svc, proc, cache);
        }

        [Fact]
        public async Task List_NullsImageData()
        {
            var (svc, proc, _) = Build();
            proc.Setup(p => p.List()).ReturnsAsync(new List<ProtocolModel>());

            var result = await svc.List();

            result.Should().ContainSingle();
            result[0].ImageData.Should().BeNull();
        }

        [Fact]
        public async Task List_IsCached_SecondCallSkipsProcessor()
        {
            var (svc, proc, _) = Build();
            proc.Setup(p => p.List()).ReturnsAsync(new List<ProtocolModel>());

            await svc.List();
            await svc.List();

            proc.Verify(p => p.List(), Times.Once);
        }

        [Fact]
        public async Task Add_InvalidatesCache()
        {
            var (svc, proc, cache) = Build();
            proc.Setup(p => p.List()).ReturnsAsync(new List<ProtocolModel>());
            proc.Setup(p => p.Add(It.IsAny<ProtocolModel>())).ReturnsAsync(new ProtocolModel { Id = 9 });
            proc.Setup(p => p.GetById(It.IsAny<int>())).ReturnsAsync((ProtocolModel?)null);
            var mapperBack = new Mock<IMapper>();

            await svc.List();                                   // populate cache
            await svc.Add(new ProtocolViewModel { Name = "x" }); // should evict
            await svc.List();                                   // re-query

            proc.Verify(p => p.List(), Times.Exactly(2));
        }
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `dotnet test Backend/SorobanSecurityPortalApi.Tests/SorobanSecurityPortalApi.Tests.csproj --filter "FullyQualifiedName~ProtocolServiceCacheTests"`
Expected: FAIL — `ProtocolService` constructor has no `ILookupCache` parameter (compile error).

- [ ] **Step 3: Modify `ProtocolService`**

In `ProtocolService.cs`, add the using:
```csharp
using SorobanSecurityPortalApi.Common.Caching;
```
Add a field and constructor parameter (the convention scan registers `IProtocolService` as scoped; `ILookupCache` is a singleton and injects fine):
```csharp
        private readonly ILookupCache _lookupCache;

        public ProtocolService(
            IMapper mapper,
            IProtocolProcessor protocolProcessor,
            UserContextAccessor userContextAccessor,
            ILookupCache lookupCache)
        {
            _mapper = mapper;
            _protocolProcessor = protocolProcessor;
            _userContextAccessor = userContextAccessor;
            _lookupCache = lookupCache;
        }
```
Replace `List()` with a cached + slimmed version:
```csharp
        public async Task<List<ProtocolViewModel>> List()
        {
            return await _lookupCache.GetOrCreateAsync(LookupCacheKeys.Protocols, async () =>
            {
                var protocols = await _protocolProcessor.List();
                var result = _mapper.Map<List<ProtocolViewModel>>(protocols);
                // Image bytes are served by /protocols/{id}/image.png; do not inline them in the bulk list.
                foreach (var p in result) p.ImageData = null;
                return result;
            });
        }
```
Add an eviction line as the FIRST statement inside `Add`, `Update`, and `Delete` method bodies:
```csharp
            _lookupCache.Remove(LookupCacheKeys.Protocols);
```
(Place it at the top of each of the three methods.)

- [ ] **Step 4: Run test + build**

Run: `dotnet test Backend/SorobanSecurityPortalApi.Tests/SorobanSecurityPortalApi.Tests.csproj --filter "FullyQualifiedName~ProtocolServiceCacheTests"`
Expected: PASS (3 tests).
Run: `dotnet build Backend/SorobanSecurityPortalApi/SorobanSecurityPortalApi.csproj` — 0 errors.

- [ ] **Step 5: Commit**

```bash
git add Backend/SorobanSecurityPortalApi/Services/ControllersServices/ProtocolService.cs Backend/SorobanSecurityPortalApi.Tests/Services/ProtocolServiceCacheTests.cs
git commit -m "Cache + slim ProtocolService.List, invalidate on write"
```

---

## Task 3: Cache + slim CompanyService and AuditorService

**Files:**
- Modify: `Backend/SorobanSecurityPortalApi/Services/ControllersServices/CompanyService.cs`
- Modify: `Backend/SorobanSecurityPortalApi/Services/ControllersServices/AuditorService.cs`
- Test: `Backend/SorobanSecurityPortalApi.Tests/Services/CompanyAuditorCacheTests.cs`

- [ ] **Step 1: Write the failing test**

Create `Backend/SorobanSecurityPortalApi.Tests/Services/CompanyAuditorCacheTests.cs`:

```csharp
using AutoMapper;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Caching.Memory;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Common.Caching;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;
using SorobanSecurityPortalApi.Services.ControllersServices;
using Xunit;

namespace SorobanSecurityPortalApi.Tests.Services
{
    public class CompanyAuditorCacheTests
    {
        private static UserContextAccessor UserCtx() =>
            new(Mock.Of<IHttpContextAccessor>(), Mock.Of<ILoginProcessor>());

        [Fact]
        public async Task CompanyList_NullsImage_AndCaches()
        {
            var proc = new Mock<ICompanyProcessor>();
            proc.Setup(p => p.List()).ReturnsAsync(new List<CompanyModel>());
            var mapper = new Mock<IMapper>();
            mapper.Setup(m => m.Map<List<CompanyViewModel>>(It.IsAny<object>()))
                  .Returns(() => new List<CompanyViewModel> { new() { Id = 1, Name = "C", ImageData = new byte[] { 9 } } });
            var svc = new CompanyService(mapper.Object, proc.Object, UserCtx(),
                                         new LookupCache(new MemoryCache(new MemoryCacheOptions())));

            var r1 = await svc.List();
            await svc.List();

            r1[0].ImageData.Should().BeNull();
            proc.Verify(p => p.List(), Times.Once);
        }

        [Fact]
        public async Task AuditorList_NullsImage_AndCaches()
        {
            var proc = new Mock<IAuditorProcessor>();
            proc.Setup(p => p.List()).ReturnsAsync(new List<AuditorModel>());
            var mapper = new Mock<IMapper>();
            mapper.Setup(m => m.Map<List<AuditorViewModel>>(It.IsAny<object>()))
                  .Returns(() => new List<AuditorViewModel> { new() { Id = 1, Name = "A", ImageData = new byte[] { 9 } } });
            var svc = new AuditorService(mapper.Object, proc.Object, UserCtx(),
                                         new LookupCache(new MemoryCache(new MemoryCacheOptions())));

            var r1 = await svc.List();
            await svc.List();

            r1[0].ImageData.Should().BeNull();
            proc.Verify(p => p.List(), Times.Once);
        }
    }
}
```

> Note: confirm the exact constructor parameter order of `CompanyService`/`AuditorService` by reading the files; they currently take `(IMapper, I<Entity>Processor, UserContextAccessor)`. Add `ILookupCache` as the last parameter and match that order in the test.

- [ ] **Step 2: Run test to verify it fails**

Run: `dotnet test Backend/SorobanSecurityPortalApi.Tests/SorobanSecurityPortalApi.Tests.csproj --filter "FullyQualifiedName~CompanyAuditorCacheTests"`
Expected: FAIL — constructors lack `ILookupCache`.

- [ ] **Step 3: Modify `CompanyService`**

Add `using SorobanSecurityPortalApi.Common.Caching;`. Add `private readonly ILookupCache _lookupCache;`, add `ILookupCache lookupCache` as the last constructor parameter and assign it. Replace `List()`:
```csharp
        public async Task<List<CompanyViewModel>> List()
        {
            return await _lookupCache.GetOrCreateAsync(LookupCacheKeys.Companies, async () =>
            {
                var companies = await _companyProcessor.List();
                var result = _mapper.Map<List<CompanyViewModel>>(companies);
                foreach (var c in result) c.ImageData = null;
                return result;
            });
        }
```
(Use the actual processor field name in this file — it is `_companyProcessor`.) Add `_lookupCache.Remove(LookupCacheKeys.Companies);` as the first statement of `Add`, `Update`, `Delete`.

- [ ] **Step 4: Modify `AuditorService`**

Add `using SorobanSecurityPortalApi.Common.Caching;`. Add the field + last constructor parameter `ILookupCache lookupCache`. Replace `List()`:
```csharp
        public async Task<List<AuditorViewModel>> List()
        {
            return await _lookupCache.GetOrCreateAsync(LookupCacheKeys.Auditors, async () =>
            {
                var auditors = await _auditorProcessor.List();
                var result = _mapper.Map<List<AuditorViewModel>>(auditors);
                foreach (var a in result) a.ImageData = null;
                return result;
            });
        }
```
(Use the actual processor field name in this file — it is `_auditorProcessor`.) Add `_lookupCache.Remove(LookupCacheKeys.Auditors);` as the first statement of `Add`, `Update`, `Delete`.

- [ ] **Step 5: Run test + build**

Run: `dotnet test Backend/SorobanSecurityPortalApi.Tests/SorobanSecurityPortalApi.Tests.csproj --filter "FullyQualifiedName~CompanyAuditorCacheTests"`
Expected: PASS (2 tests).
Run: `dotnet build Backend/SorobanSecurityPortalApi/SorobanSecurityPortalApi.csproj` — 0 errors.

- [ ] **Step 6: Commit**

```bash
git add Backend/SorobanSecurityPortalApi/Services/ControllersServices/CompanyService.cs Backend/SorobanSecurityPortalApi/Services/ControllersServices/AuditorService.cs Backend/SorobanSecurityPortalApi.Tests/Services/CompanyAuditorCacheTests.cs
git commit -m "Cache + slim Company/Auditor List, invalidate on write"
```

---

## Task 4: Cache tags, sources, and reports list

**Files:**
- Modify: `Backend/SorobanSecurityPortalApi/Services/ControllersServices/CategoryService.cs` (tags)
- Modify: `Backend/SorobanSecurityPortalApi/Services/ControllersServices/VulnerabilitiesService.cs` (`ListSources`)
- Modify: `Backend/SorobanSecurityPortalApi/Services/ControllersServices/ReportService.cs` (`GetList`)
- Test: `Backend/SorobanSecurityPortalApi.Tests/Services/LookupListCacheTests.cs`

- [ ] **Step 1: Write the failing test**

Create `Backend/SorobanSecurityPortalApi.Tests/Services/LookupListCacheTests.cs`:

```csharp
using AutoMapper;
using Microsoft.Extensions.Caching.Memory;
using SorobanSecurityPortalApi.Common.Caching;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;
using SorobanSecurityPortalApi.Services.ControllersServices;
using Xunit;

namespace SorobanSecurityPortalApi.Tests.Services
{
    public class LookupListCacheTests
    {
        [Fact]
        public async Task CategoryList_IsCached_AndInvalidatedOnAdd()
        {
            var proc = new Mock<ICategoryProcessor>();
            proc.Setup(p => p.List()).ReturnsAsync(new List<CategoryModel>());
            proc.Setup(p => p.Add(It.IsAny<CategoryModel>())).ReturnsAsync(new CategoryModel { Id = 1 });
            var mapper = new Mock<IMapper>();
            mapper.Setup(m => m.Map<List<CategoryViewModel>>(It.IsAny<object>())).Returns(new List<CategoryViewModel>());
            mapper.Setup(m => m.Map<CategoryModel>(It.IsAny<object>())).Returns(new CategoryModel());
            mapper.Setup(m => m.Map<CategoryViewModel>(It.IsAny<object>())).Returns(new CategoryViewModel());
            var svc = new CategoryService(mapper.Object, proc.Object,
                                          new LookupCache(new MemoryCache(new MemoryCacheOptions())));

            await svc.List();
            await svc.List();
            proc.Verify(p => p.List(), Times.Once);

            await svc.Add(new CategoryViewModel());
            await svc.List();
            proc.Verify(p => p.List(), Times.Exactly(2));
        }
    }
}
```

> Note: read `CategoryService.cs` for its exact constructor signature (it is `(IMapper, ICategoryProcessor)` today — add `ILookupCache` as the last parameter and match here). If `CategoryService` has no `UserContextAccessor`, omit it as shown.

- [ ] **Step 2: Run test to verify it fails**

Run: `dotnet test Backend/SorobanSecurityPortalApi.Tests/SorobanSecurityPortalApi.Tests.csproj --filter "FullyQualifiedName~LookupListCacheTests"`
Expected: FAIL — `CategoryService` constructor lacks `ILookupCache`.

- [ ] **Step 3: Modify `CategoryService` (tags)**

Add `using SorobanSecurityPortalApi.Common.Caching;`, a `private readonly ILookupCache _lookupCache;` field, add `ILookupCache lookupCache` as the last constructor param and assign. Replace `List()`:
```csharp
        public async Task<List<CategoryViewModel>> List()
        {
            return await _lookupCache.GetOrCreateAsync(LookupCacheKeys.Tags, async () =>
            {
                var categories = await _categoryProcessor.List();
                return _mapper.Map<List<CategoryViewModel>>(categories);
            });
        }
```
(Use the actual processor field name in this file.) Add `_lookupCache.Remove(LookupCacheKeys.Tags);` as the first statement of `Add`, `Update`, `Delete`.

- [ ] **Step 4: Modify `VulnerabilitiesService.ListSources`**

In `VulnerabilitiesService.cs` add `using SorobanSecurityPortalApi.Common.Caching;`, add `private readonly ILookupCache _lookupCache;`, add `ILookupCache lookupCache` as the last constructor parameter and assign it. Wrap the existing `ListSources` body:
```csharp
        public async Task<List<IdValueUrl>> ListSources()
        {
            return await _lookupCache.GetOrCreateAsync(LookupCacheKeys.Sources, async () =>
            {
                var reports = await _reportProcessor.GetList();
                var result = new List<IdValueUrl>();
                foreach (var report in reports)
                {
                    result.Add(new IdValueUrl
                    {
                        Id = report.Id,
                        Name = report.Name,
                        Url = "",
                        ProtocolId = report.Protocol?.Id,
                        AuditorId = report.Auditor?.Id
                    });
                }
                result.Add(new IdValueUrl { Id = 0, Name = "External", Url = "" });
                return result;
            });
        }
```

- [ ] **Step 5: Modify `ReportService.GetList` + invalidation**

In `ReportService.cs` add `using SorobanSecurityPortalApi.Common.Caching;`, add `private readonly ILookupCache _lookupCache;` and add `ILookupCache lookupCache` as the last constructor parameter and assign it. Replace `GetList`:
```csharp
        public async Task<List<ReportViewModel>> GetList(bool includeNotApproved = false)
        {
            // Only the public (approved) list is a cacheable lookup; the admin "include everything"
            // variant is uncached.
            if (includeNotApproved)
            {
                var all = await _reportProcessor.GetList(true);
                return _mapper.Map<List<ReportViewModel>>(all);
            }
            return await _lookupCache.GetOrCreateAsync(LookupCacheKeys.Reports, async () =>
            {
                var reports = await _reportProcessor.GetList(false);
                return _mapper.Map<List<ReportViewModel>>(reports);
            });
        }
```
Add `_lookupCache.Remove(LookupCacheKeys.Reports);` AND `_lookupCache.Remove(LookupCacheKeys.Sources);` as the first statements of `Add`, `Approve`, `Reject`, `Update`, and `Remove` in `ReportService` (the sources lookup is derived from reports, so it must be evicted too). Do NOT add eviction to `RecompressAllImages` (it does not change list-visible fields).

- [ ] **Step 6: Run test + build**

Run: `dotnet test Backend/SorobanSecurityPortalApi.Tests/SorobanSecurityPortalApi.Tests.csproj --filter "FullyQualifiedName~LookupListCacheTests"`
Expected: PASS.
Run: `dotnet build Backend/SorobanSecurityPortalApi/SorobanSecurityPortalApi.csproj` — 0 errors.

- [ ] **Step 7: Commit**

```bash
git add Backend/SorobanSecurityPortalApi/Services/ControllersServices/CategoryService.cs Backend/SorobanSecurityPortalApi/Services/ControllersServices/VulnerabilitiesService.cs Backend/SorobanSecurityPortalApi/Services/ControllersServices/ReportService.cs Backend/SorobanSecurityPortalApi.Tests/Services/LookupListCacheTests.cs
git commit -m "Cache tags/sources/reports lookups, invalidate on write"
```

---

## Task 5: `SearchWithTotal` + `X-Total-Count` header

**Files:**
- Modify: `Backend/SorobanSecurityPortalApi/Services/ControllersServices/VulnerabilitiesService.cs`
- Modify: `Backend/SorobanSecurityPortalApi/Controllers/VulnerabilitiesController.cs`
- Test: `Backend/SorobanSecurityPortalApi.Tests/Controllers/VulnerabilitiesSearchTotalTests.cs`

- [ ] **Step 1: Write the failing test**

Create `Backend/SorobanSecurityPortalApi.Tests/Controllers/VulnerabilitiesSearchTotalTests.cs`:

```csharp
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using SorobanSecurityPortalApi.Controllers;
using SorobanSecurityPortalApi.Models.ViewModels;
using SorobanSecurityPortalApi.Services.ControllersServices;
using Xunit;

namespace SorobanSecurityPortalApi.Tests.Controllers
{
    public class VulnerabilitiesSearchTotalTests
    {
        [Fact]
        public async Task Search_ReturnsItems_AndSetsXTotalCountHeader()
        {
            var items = new List<VulnerabilityViewModel> { new() { Id = 1 }, new() { Id = 2 } };
            var svc = new Mock<IVulnerabilityService>();
            svc.Setup(s => s.SearchWithTotal(It.IsAny<VulnerabilitySearchViewModel?>()))
               .ReturnsAsync((items, 57));
            var controller = new VulnerabilitiesController(svc.Object)
            {
                ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }
            };

            var result = await controller.Search(new VulnerabilitySearchViewModel());

            var ok = Assert.IsType<OkObjectResult>(result);
            Assert.Same(items, ok.Value);
            Assert.Equal("57", controller.Response.Headers["X-Total-Count"].ToString());
            svc.Verify(s => s.SearchWithTotal(It.IsAny<VulnerabilitySearchViewModel?>()), Times.Once);
        }
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `dotnet test Backend/SorobanSecurityPortalApi.Tests/SorobanSecurityPortalApi.Tests.csproj --filter "FullyQualifiedName~VulnerabilitiesSearchTotalTests"`
Expected: FAIL — `IVulnerabilityService.SearchWithTotal` does not exist.

- [ ] **Step 3: Add `SearchWithTotal` to the service + interface**

In `VulnerabilitiesService.cs`, add to the `IVulnerabilityService` interface:
```csharp
        Task<(List<VulnerabilityViewModel> Items, int Total)> SearchWithTotal(VulnerabilitySearchViewModel? vulnerabilitySearch);
```
Add the implementation (generates the embedding once, then runs both queries on the shared model):
```csharp
        public async Task<(List<VulnerabilityViewModel> Items, int Total)> SearchWithTotal(VulnerabilitySearchViewModel? vulnerabilitySearchViewModel)
        {
            var model = _mapper.Map<Models.DbModels.VulnerabilitySearchModel>(vulnerabilitySearchViewModel);
            if (model != null && !string.IsNullOrEmpty(model.SearchText))
            {
                var embeddingArray = await _embeddingService.GenerateEmbeddingForDocumentAsync(model.SearchText);
                model.Embedding = new Vector(embeddingArray);
            }
            var items = _mapper.Map<List<VulnerabilityViewModel>>(await _vulnerabilityProcessor.Search(model!));
            var total = await _vulnerabilityProcessor.SearchTotal(model!);
            return (items, total);
        }
```

- [ ] **Step 4: Update the controller `Search` action**

In `VulnerabilitiesController.cs`, replace the `Search` action body:
```csharp
        [HttpPost]
        public async Task<IActionResult> Search([FromBody] VulnerabilitySearchViewModel? vulnerabilitySearch)
        {
            var (items, total) = await _vulnerabilityService.SearchWithTotal(vulnerabilitySearch);
            Response.Headers["X-Total-Count"] = total.ToString();
            return Ok(items);
        }
```
Leave the `SearchTotal` action and `IVulnerabilityService.SearchTotal` unchanged (still used by other callers).

- [ ] **Step 5: Run test + full suite + build**

Run: `dotnet test Backend/SorobanSecurityPortalApi.Tests/SorobanSecurityPortalApi.Tests.csproj --filter "FullyQualifiedName~VulnerabilitiesSearchTotalTests"`
Expected: PASS.
Run: `dotnet test Backend/SorobanSecurityPortalApi.Tests/SorobanSecurityPortalApi.Tests.csproj`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add Backend/SorobanSecurityPortalApi/Services/ControllersServices/VulnerabilitiesService.cs Backend/SorobanSecurityPortalApi/Controllers/VulnerabilitiesController.cs Backend/SorobanSecurityPortalApi.Tests/Controllers/VulnerabilitiesSearchTotalTests.cs
git commit -m "Return vulnerability search total via X-Total-Count header (one request)"
```

---

## Task 6: UI — single search call reading the total header

**Files:**
- Modify: `UI/src/api/soroban-security-portal/soroban-security-portal-api.ts`
- Modify: `UI/src/features/pages/regular/vulnerabilities/hooks/vulnerabilities.hook.ts`
- Test: `UI/src/api/soroban-security-portal/__tests__/vulnerabilities-total-header.test.ts`

- [ ] **Step 1: Write the failing test**

Create `UI/src/api/soroban-security-portal/__tests__/vulnerabilities-total-header.test.ts`. Mirror the style of the existing `__tests__/vulnerability-description-api.test.ts` (read that file first for the exact mock of `getRestClient`). The test mocks the REST client's `request` to resolve `{ data: [{id:1}], headers: { 'x-total-count': '57' } }` and asserts:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getVulnerabilitiesWithTotalCall } from '../soroban-security-portal-api';

// Mock getRestClient to return a fake client (match the path/shape used by the existing
// vulnerability-description-api.test.ts in this folder).
vi.mock('../client-sso', async () => {
  return {
    getRestClient: async () => ({
      request: vi.fn().mockResolvedValue({ data: [{ id: 1 }, { id: 2 }], headers: { 'x-total-count': '57' } }),
    }),
  };
});

describe('getVulnerabilitiesWithTotalCall', () => {
  it('returns items and total parsed from X-Total-Count header', async () => {
    const res = await getVulnerabilitiesWithTotalCall({ page: 1, pageSize: 10 } as any);
    expect(res.items).toHaveLength(2);
    expect(res.total).toBe(57);
  });
});
```
> Read `vulnerability-description-api.test.ts` first and copy its exact `getRestClient` mock target/path; adjust the `vi.mock` path above to match (it may mock a different module than `../client-sso`).

- [ ] **Step 2: Run test to verify it fails**

Run: `cd UI; npm test -- --run src/api/soroban-security-portal/__tests__/vulnerabilities-total-header.test.ts`
Expected: FAIL — `getVulnerabilitiesWithTotalCall` is not exported.

- [ ] **Step 3: Add the API function**

In `UI/src/api/soroban-security-portal/soroban-security-portal-api.ts`, just after `getVulnerabilitiesCall` (line ~300), add:
```ts
export const getVulnerabilitiesWithTotalCall = async (
    vulnerabilitySearch?: VulnerabilitySearch
): Promise<{ items: Vulnerability[]; total: number }> => {
    const client = await getRestClient();
    const response = await client.request('api/v1/vulnerabilities', 'POST', vulnerabilitySearch);
    const header = response.headers?.['x-total-count'];
    const total = header != null ? parseInt(String(header), 10) : (response.data as Vulnerability[]).length;
    return { items: response.data as Vulnerability[], total: Number.isNaN(total) ? 0 : total };
};
```

- [ ] **Step 4: Update the hook to make one call**

In `UI/src/features/pages/regular/vulnerabilities/hooks/vulnerabilities.hook.ts`:
- Add `getVulnerabilitiesWithTotalCall` to the import from the api module and remove `getVulnerabilitiesTotalCall` from that import.
- Replace the body of `searchVulnerabilities` (the part after `vulnerabilitySearch.includeDescription = false;`) so it makes a single call and sets both list and total:
```ts
    vulnerabilitySearch.includeDescription = false;
    setIsLoadingInitial(true);
    const response = await getVulnerabilitiesWithTotalCall(vulnerabilitySearch);
    setVulnerabilitiesList(response.items);
    setTotalItems(response.total);
    setIsLoadingInitial(false);
```
- Delete the now-unused `getTotalItems` function (lines ~94-97) and any remaining reference to it.

- [ ] **Step 5: Run test + UI typecheck/build**

Run: `cd UI; npm test -- --run src/api/soroban-security-portal/__tests__/vulnerabilities-total-header.test.ts`
Expected: PASS.
Run: `cd UI; npm run build`
Expected: build succeeds (no TS errors — confirms the removed `getTotalItems`/`getVulnerabilitiesTotalCall` references are all cleaned up).

- [ ] **Step 6: Commit**

```bash
git add UI/src/api/soroban-security-portal/soroban-security-portal-api.ts UI/src/features/pages/regular/vulnerabilities/hooks/vulnerabilities.hook.ts UI/src/api/soroban-security-portal/__tests__/vulnerabilities-total-header.test.ts
git commit -m "Vulnerabilities page: one search request, read total from header"
```

---

## Task 7: Verification (build, full suites, dev re-measure)

No code changes — verify the whole feature end to end.

- [ ] **Step 1: Full backend suite**

Run: `dotnet test Backend/SorobanSecurityPortalApi.Tests/SorobanSecurityPortalApi.Tests.csproj`
Expected: all pass (existing + new).

- [ ] **Step 2: UI tests + build**

Run: `cd UI; npm test -- --run` then `npm run build`
Expected: all pass; build clean.

- [ ] **Step 3: Deploy to dev and re-measure (Playwright)**

Build/push `andreykerchin/soroban-security-portal{,-ui}` with a new tag, `helm upgrade ... --reuse-values --set global.sorobansecurityportal.service.tag=<tag> --set-string global.app.build=<ts>` (kubeconfig at repo `kubeconfig.temp`). Then with Playwright on `https://sorobanshield.ru/vulnerabilities`:
- Capture Resource Timing for `/api/v1/` calls: confirm the page no longer calls `vulnerabilities/total`; confirm `protocols`/`companies` payloads are now a few KB (no inline images); confirm second page load serves lookups from cache (lower TTFB).
- Confirm the filter dropdowns (severities, tags, protocols, companies, auditors, sources) still populate, the list renders, lazy description on card expand still works, and an admin edit of a protocol still shows its existing image (served via `/protocols/{id}/image.png`).
- Sanity: after editing a protocol/company/auditor/tag/report in admin, its lookup reflects the change immediately (invalidation works).

---

## Notes for the implementer

- **DI:** services are auto-registered by the `ForInterfacesMatching("^I(?!.*Processor$).*")` scan in `Startup.cs`. `ILookupCache` is registered explicitly as a singleton BEFORE the scans (Task 1), so the scan skips it. Singleton `ILookupCache` injected into scoped services is correct (`IMemoryCache` is itself singleton/thread-safe).
- **Constructor order:** always add `ILookupCache` as the LAST constructor parameter and update the matching test `new <Service>(...)` calls. Read each service file before editing to use its real processor field name.
- **Same-origin:** UI and API share the origin (`https://sorobanshield.ru`, API under `/api/v1`), so the browser can read `X-Total-Count` with no `Access-Control-Expose-Headers` needed.
- **Don't** cache `ListSeverities` (a static in-code list — no DB work to save) and don't add DB indexes (the table is 670 rows; the query is 0.4 ms — proven non-bottleneck).
- **Commit footer:** end every commit message with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

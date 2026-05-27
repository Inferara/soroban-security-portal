# User Search (mention autocomplete foundation) — Implementation Plan (PR7b)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The `GET /api/v1/user/search?q=` endpoint (#75) + a debounced `useUserSearch` frontend hook — the testable foundation the `@mention` autocomplete will consume.

**Architecture:** `LoginProcessor.SearchUsers(q, limit)` (case-insensitive contains on username + full name) → `UserService.SearchUsers(q)` (maps to a small DTO, top 5) → `UserController` GET `search` (auth-gated). Frontend `searchUsersCall` + `useUserSearch(query)` (300 ms debounce).

**Tech Stack:** C#/EF/xUnit; React/TS/Vitest. Branch `feature/comments-discussion`.

**Scope:** search endpoint + search hook (both fully testable). **Explicitly OUT (needs a running browser to verify — do as a separate, smoke-tested step):** the Monaco in-editor `@`-autocomplete dropdown, and mention-link rendering in posted comments (also needs a public-profile-by-id route + the comment DTO to carry its mentions). **PR8:** SignalR client + bell + `/mentions`.

---

### Task 1: Backend `GET /api/v1/user/search?q=` (TDD)

**Files:**
- Create: `Backend/SorobanSecurityPortalApi/Models/ViewModels/UserSearchResultViewModel.cs`
- Modify: `Backend/SorobanSecurityPortalApi/Data/Processors/LoginProcessor.cs` (add `SearchUsers`)
- Modify: `Backend/SorobanSecurityPortalApi/Services/ControllersServices/UserService.cs` (add `SearchUsers`)
- Modify: `Backend/SorobanSecurityPortalApi/Controllers/UserController.cs` (add `search` endpoint)
- Create/modify tests: `Backend/SorobanSecurityPortalApi.Tests/...` (LoginProcessor search + UserService mapping)

- [ ] **Step 1: DTO**

`UserSearchResultViewModel.cs`:

```csharp
namespace SorobanSecurityPortalApi.Models.ViewModels
{
    // Minimal public user info for @mention autocomplete — no PII beyond display name + username.
    public class UserSearchResultViewModel
    {
        public int Id { get; set; }
        public string DisplayName { get; set; } = string.Empty;
        public string Username { get; set; } = string.Empty;
    }
}
```

- [ ] **Step 2: `LoginProcessor.SearchUsers` (TDD)**

Add to `ILoginProcessor` + `LoginProcessor` (it uses `IDbContextFactory<Db>` — match its actual field name; `LoginModel.FullName` is non-null `string`, default `""`):

```csharp
        public async Task<List<LoginModel>> SearchUsers(string q, int limit)
        {
            if (string.IsNullOrWhiteSpace(q)) return new List<LoginModel>();
            var ql = q.ToLower();
            await using var db = await _dbFactory.CreateDbContextAsync();
            return await db.Login.AsNoTracking()
                .Where(l => l.Login.ToLower().Contains(ql) || l.FullName.ToLower().Contains(ql))
                .OrderBy(l => l.Login)
                .Take(limit)
                .ToListAsync();
        }
```
Interface: `Task<List<LoginModel>> SearchUsers(string q, int limit);`

Test — add `Backend/SorobanSecurityPortalApi.Tests/Data/LoginProcessorTests.cs` (Mock<Db> pattern; `Db.Login` is NOT virtual → `db.Object.Login = Set(logins).Object`; reuse `TestAsyncQueryProvider`/`TestAsyncEnumerator` from `SorobanSecurityPortalApi.Tests.Services`):

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
    public class LoginProcessorTests
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
            return m;
        }

        private static LoginProcessor Build(List<LoginModel> logins)
        {
            var db = new Mock<Db>(
                new Mock<IDbQuery>().Object,
                new Mock<Microsoft.Extensions.Logging.ILogger<Db>>().Object,
                new Mock<IDataSourceProvider>().Object) { CallBase = true };
            db.Object.Login = Set(logins).Object;
            var f = new Mock<IDbContextFactory<Db>>();
            f.Setup(x => x.CreateDbContextAsync(It.IsAny<CancellationToken>())).ReturnsAsync(db.Object);
            return new LoginProcessor(f.Object);
        }

        [Fact]
        public async Task SearchUsers_Matches_Username_Or_FullName_CaseInsensitive_Limited()
        {
            var logins = new List<LoginModel>
            {
                new() { LoginId = 1, Login = "alice", FullName = "Alice Adams" },
                new() { LoginId = 2, Login = "bob", FullName = "Bob Brown" },
                new() { LoginId = 3, Login = "carol", FullName = "Alicia Carter" }, // matches "ali" via FullName
            };
            var res = await Build(logins).SearchUsers("ALI", 5);
            res.Select(l => l.LoginId).Should().BeEquivalentTo(new[] { 1, 3 });
        }

        [Fact]
        public async Task SearchUsers_Empty_Query_Returns_Empty()
        {
            (await Build(new List<LoginModel> { new() { LoginId = 1, Login = "alice", FullName = "A" } }).SearchUsers("  ", 5))
                .Should().BeEmpty();
        }

        [Fact]
        public async Task SearchUsers_Respects_Limit()
        {
            var logins = Enumerable.Range(1, 10).Select(i => new LoginModel { LoginId = i, Login = $"user{i}", FullName = "X" }).ToList();
            (await Build(logins).SearchUsers("user", 5)).Should().HaveCount(5);
        }
    }
}
```
(If `LoginProcessor`'s ctor differs — e.g. a different factory field — adapt the `Build` helper to its real constructor. Read `LoginProcessor.cs` first.)

- [ ] **Step 3: `UserService.SearchUsers` (TDD)**

Add to `IUserService` + `UserService` (it should already have access to `ILoginProcessor` — if not, inject it):

```csharp
        public async Task<List<UserSearchResultViewModel>> SearchUsers(string q)
        {
            var rows = await _loginProcessor.SearchUsers(q, 5);
            return rows.Select(l => new UserSearchResultViewModel
            {
                Id = l.LoginId,
                Username = l.Login,
                DisplayName = string.IsNullOrWhiteSpace(l.FullName) ? l.Login : l.FullName
            }).ToList();
        }
```
Interface: `Task<List<UserSearchResultViewModel>> SearchUsers(string q);`

Add a `UserService` test (mock `ILoginProcessor.SearchUsers` returning a couple `LoginModel`s with/without FullName; assert the DTO maps `DisplayName = FullName ?? Login` and limit is passed as 5). If a `UserServiceTests` file exists, add there; else create one following the repo's service-test style.

- [ ] **Step 4: `UserController` endpoint**

In `UserController.cs` (class is already `[Authorize]`, route `api/v1/user`), add:

```csharp
        [HttpGet("search")]
        public async Task<IActionResult> Search([FromQuery] string? q)
            => Ok(await _userService.SearchUsers(q ?? string.Empty));
```
(The literal `search` segment takes precedence over `{loginId}` because `loginId` binds to `int` and "search" isn't numeric — but the literal route is matched first regardless.)

- [ ] **Step 5: Build + tests + commit**

`dotnet build Backend/SorobanSecurityPortalApi/SorobanSecurityPortalApi.csproj -v quiet --nologo` → 0 errors. `dotnet test Backend/SorobanSecurityPortalApi.Tests` → 0 failures (302 + new).

```bash
git add Backend/SorobanSecurityPortalApi/Models/ViewModels/UserSearchResultViewModel.cs Backend/SorobanSecurityPortalApi/Data/Processors/LoginProcessor.cs Backend/SorobanSecurityPortalApi/Services/ControllersServices/UserService.cs Backend/SorobanSecurityPortalApi/Controllers/UserController.cs Backend/SorobanSecurityPortalApi.Tests/
git commit -m "feat(comments): add GET /api/v1/user/search for @mention autocomplete"
```
(Append `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>` trailer.)

---

### Task 2: Frontend `searchUsersCall` + `useUserSearch` (TDD)

**Files:**
- Modify: `UI/src/api/soroban-security-portal/models/comment.ts` (add `UserSearchResult`)
- Modify: `UI/src/api/soroban-security-portal/soroban-security-portal-api.ts` (add `searchUsersCall`)
- Create: `UI/src/features/comments/useUserSearch.ts`
- Create: `UI/src/features/comments/__tests__/useUserSearch.test.ts`

- [ ] **Step 1: Model + API call**

In `models/comment.ts`:
```typescript
export interface UserSearchResult {
  id: number;
  displayName: string;
  username: string;
}
```
In `soroban-security-portal-api.ts` (import `UserSearchResult`):
```typescript
export const searchUsersCall = async (q: string): Promise<UserSearchResult[]> => {
    const client = await getRestClient();
    const response = await client.request(`api/v1/user/search?q=${encodeURIComponent(q)}`, 'GET');
    return response.data as UserSearchResult[];
};
```

- [ ] **Step 2: `useUserSearch` hook (debounced)**

`UI/src/features/comments/useUserSearch.ts`:
```typescript
import { useEffect, useState } from 'react';
import { searchUsersCall } from '../../api/soroban-security-portal/soroban-security-portal-api';
import { UserSearchResult } from '../../api/soroban-security-portal/models/comment';

const DEBOUNCE_MS = 300;

export const useUserSearch = (query: string, minLength = 1): UserSearchResult[] => {
  const [results, setResults] = useState<UserSearchResult[]>([]);
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < minLength) {
      setResults([]);
      return;
    }
    const handle = setTimeout(() => {
      searchUsersCall(trimmed).then(setResults).catch(() => setResults([]));
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [query, minLength]);
  return results;
};
```

- [ ] **Step 3: Test (fake timers)**

`__tests__/useUserSearch.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useUserSearch } from '../useUserSearch';

vi.mock('../../../api/soroban-security-portal/soroban-security-portal-api', () => ({
  searchUsersCall: vi.fn().mockResolvedValue([{ id: 1, displayName: 'Alice', username: 'alice' }]),
}));
import { searchUsersCall } from '../../../api/soroban-security-portal/soroban-security-portal-api';

describe('useUserSearch', () => {
  beforeEach(() => { vi.useFakeTimers(); (searchUsersCall as any).mockClear(); });
  afterEach(() => { vi.useRealTimers(); });

  it('does not search below minLength', () => {
    renderHook(() => useUserSearch('', 1));
    vi.advanceTimersByTime(400);
    expect(searchUsersCall).not.toHaveBeenCalled();
  });

  it('debounces and searches after 300ms', async () => {
    const { result, rerender } = renderHook(({ q }) => useUserSearch(q, 1), { initialProps: { q: 'al' } });
    vi.advanceTimersByTime(299);
    expect(searchUsersCall).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(searchUsersCall).toHaveBeenCalledWith('al');
    await vi.waitFor(() => expect(result.current).toHaveLength(1));
  });

  it('debounce cancels the prior pending search on rapid change', () => {
    const { rerender } = renderHook(({ q }) => useUserSearch(q, 1), { initialProps: { q: 'a' } });
    vi.advanceTimersByTime(100);
    rerender({ q: 'al' });
    vi.advanceTimersByTime(100);
    rerender({ q: 'ali' });
    vi.advanceTimersByTime(300);
    expect(searchUsersCall).toHaveBeenCalledTimes(1);
    expect(searchUsersCall).toHaveBeenCalledWith('ali');
  });
});
```
(If `vi.waitFor` + fake timers interact poorly, resolve the promise via `await vi.runAllTimersAsync()` / flush microtasks; adjust to make the assertions deterministic while keeping the debounce + cancel coverage.)

- [ ] **Step 4: tsc + lint + test + commit**

From `UI/`: `npx tsc --noEmit` → 0; `npm run lint` → clean; `npm run test -- --run src/features/comments` → pass.

```bash
git add UI/src/api/soroban-security-portal/models/comment.ts UI/src/api/soroban-security-portal/soroban-security-portal-api.ts UI/src/features/comments/useUserSearch.ts UI/src/features/comments/__tests__/useUserSearch.test.ts
git commit -m "feat(comments-ui): searchUsersCall + useUserSearch debounced hook"
```

---

## Self-Review

**Spec coverage (#75 search foundation):** `GET /api/v1/user/search?q=` returns up to 5 users matched case-insensitively on username OR full name (auth-gated); minimal DTO (no PII); frontend `searchUsersCall` + a 300 ms-debounced `useUserSearch` hook with min-length + cancel-on-change. **Deferred (browser-verification needed):** the Monaco `@`-autocomplete dropdown that consumes this hook, and mention-link rendering.

**Placeholder scan:** none — full code + commands. Two flagged adaptation points: `LoginProcessor`'s ctor/factory field name (read it), and whether `UserService` already injects `ILoginProcessor`.

**Type consistency:** `UserSearchResultViewModel`/`UserSearchResult` (Id/DisplayName/Username) match across backend DTO + frontend model + the API call; `SearchUsers(q, limit)` (processor) vs `SearchUsers(q)` (service, fixes limit=5) consistent with callers.

## Carry-forwards (browser-dependent — recommend a running-app smoke test)
- **Monaco `@`-autocomplete:** register a markdown completion provider (trigger `@`, debounced via `searchUsersCall`/`useUserSearch`, insert the username). Register once (not per mount). Hard to unit-test → verify in a browser.
- **Mention-link rendering:** include the comment's resolved mentions in the `Comment` DTO (from the `mention` table) + render `@username` as a profile link in `MarkdownView` output (highlight against RAW `content`); needs a public-profile-by-id route if one doesn't exist.
- **PR8:** `useSignalR` + `NotificationBell` + `/mentions` inbox (also browser-dependent for the live socket).

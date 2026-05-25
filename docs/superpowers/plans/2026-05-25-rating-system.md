# Protocol & Auditor Rating System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete issue #78 end-to-end — a 1-5 star rating + review system with summary, distribution chart, rate/update dialog, and author-attributed reviews — on both Protocol and Auditor detail pages, backed by the existing `/api/v1/ratings` API.

**Architecture:** Extend the already-merged backend (additive only: author fields, `/mine` endpoint, weighted average, entity validation) and build entity-generic React components mounted as a "Reviews" tab on both detail pages.

**Tech Stack:** .NET 10 / EF Core / AutoMapper / xUnit+Moq (backend); React 19 / TypeScript / MUI / Vitest (frontend); Docker + Helm + K3S (deploy).

**Verified facts:** DbSets are `Login`, `UserProfiles`, `Protocol`, `Auditor`, `Rating`. `/api/v1/user/{id}/avatar.png` is `[AllowAnonymous]`. Tests mock `Db` and seed only `Rating` — harness must be extended for new single-set queries.

---

## BACKEND

### Task 1: Add author + weighted fields to view models

**Files:** Modify `Backend/SorobanSecurityPortalApi/Models/ViewModels/RatingViewModel.cs`

- [ ] **Step 1:** In `PublicRatingViewModel` add:
```csharp
public int AuthorId { get; set; }
public string AuthorName { get; set; } = string.Empty;
```
- [ ] **Step 2:** In `RatingSummaryViewModel` add (after `AverageScore`):
```csharp
public float WeightedAverageScore { get; set; }
```
- [ ] **Step 3:** Commit `feat(ratings): add author + weighted-average fields to view models`

### Task 2: Service — author names, GetMyRating, weighted average, entity validation

**Files:** Modify `Backend/SorobanSecurityPortalApi/Services/ControllersServices/RatingService.cs`

- [ ] **Step 1:** Add to `IRatingService`:
```csharp
Task<RatingViewModel?> GetMyRating(EntityType entityType, int entityId);
```
- [ ] **Step 2:** Replace `GetRatings` body so authors are populated via a **second single-set query** (no cross-set join, mock-friendly):
```csharp
public async Task<List<PublicRatingViewModel>> GetRatings(EntityType entityType, int entityId, int page, int pageSize = 10)
{
    page = Math.Max(1, page);
    pageSize = Math.Max(1, Math.Min(100, pageSize));

    var ratings = await _db.Rating.AsNoTracking()
        .Where(r => r.EntityType == entityType && r.EntityId == entityId)
        .OrderByDescending(r => r.CreatedAt)
        .Skip((page - 1) * pageSize)
        .Take(pageSize)
        .ToListAsync();

    var result = _mapper.Map<List<PublicRatingViewModel>>(ratings);

    var userIds = ratings.Select(r => r.UserId).Distinct().ToList();
    if (userIds.Count > 0)
    {
        var names = await _db.Login.AsNoTracking()
            .Where(l => userIds.Contains(l.LoginId))
            .Select(l => new { l.LoginId, l.FullName, l.Login })
            .ToListAsync();
        var nameById = names.ToDictionary(
            n => n.LoginId,
            n => !string.IsNullOrWhiteSpace(n.FullName) ? n.FullName : n.Login);

        for (int i = 0; i < result.Count; i++)
        {
            result[i].AuthorId = ratings[i].UserId;
            result[i].AuthorName = nameById.TryGetValue(ratings[i].UserId, out var nm) && !string.IsNullOrWhiteSpace(nm)
                ? nm : "Anonymous";
        }
    }
    return result;
}
```
- [ ] **Step 3:** In `GetSummary`, after building `summary` and before caching, add the weighted average (second single-set query for reputation; existing aggregate query untouched):
```csharp
var scored = await _db.Rating.AsNoTracking()
    .Where(r => r.EntityType == entityType && r.EntityId == entityId)
    .Select(r => new { r.UserId, r.Score })
    .ToListAsync();

if (scored.Count > 0)
{
    var ids = scored.Select(s => s.UserId).Distinct().ToList();
    var reps = await _db.UserProfiles.AsNoTracking()
        .Where(up => ids.Contains(up.LoginId))
        .ToDictionaryAsync(up => up.LoginId, up => up.ReputationScore);

    double weightedSum = 0, weightTotal = 0;
    foreach (var s in scored)
    {
        var weight = 1.0 + (reps.TryGetValue(s.UserId, out var rep) ? rep : 0);
        weightedSum += s.Score * weight;
        weightTotal += weight;
    }
    summary.WeightedAverageScore = weightTotal > 0 ? (float)Math.Round(weightedSum / weightTotal, 1) : summary.AverageScore;
}
else
{
    summary.WeightedAverageScore = 0f;
}
```
- [ ] **Step 4:** In `AddOrUpdateRating`, after the `userId == 0` guard, validate entity existence:
```csharp
var entityExists = request.EntityType == EntityType.Protocol
    ? await _db.Protocol.AnyAsync(p => p.Id == request.EntityId)
    : await _db.Auditor.AnyAsync(a => a.Id == request.EntityId);
if (!entityExists)
    throw new KeyNotFoundException($"{request.EntityType} with id {request.EntityId} not found.");
```
- [ ] **Step 5:** Add `GetMyRating` implementation:
```csharp
public async Task<RatingViewModel?> GetMyRating(EntityType entityType, int entityId)
{
    var userId = await _userContext.GetLoginIdAsync();
    if (userId == 0) return null;
    var rating = await _db.Rating.AsNoTracking()
        .FirstOrDefaultAsync(r => r.UserId == userId && r.EntityType == entityType && r.EntityId == entityId);
    return rating == null ? null : _mapper.Map<RatingViewModel>(rating);
}
```
- [ ] **Step 6:** Commit `feat(ratings): author names, weighted avg, GetMyRating, entity validation`

### Task 3: Controller — /mine endpoint + 404 on missing entity

**Files:** Modify `Backend/SorobanSecurityPortalApi/Controllers/RatingController.cs`

- [ ] **Step 1:** Add the `mine` action:
```csharp
[HttpGet("mine")]
[Authorize]
public async Task<IActionResult> GetMine([FromQuery] EntityType entityType, [FromQuery] int entityId)
{
    if (entityId <= 0) return BadRequest("EntityId must be a positive integer.");
    var result = await _ratingService.GetMyRating(entityType, entityId);
    if (result == null) return NoContent();
    return Ok(result);
}
```
- [ ] **Step 2:** Wrap the `CreateOrUpdate` service call to translate `KeyNotFoundException` into 404:
```csharp
try
{
    var result = await _ratingService.AddOrUpdateRating(request);
    return Ok(result);
}
catch (KeyNotFoundException ex)
{
    return NotFound(ex.Message);
}
```
- [ ] **Step 3:** Commit `feat(ratings): add GET /mine and 404 on rating a missing entity`

### Task 4: Backend tests

**Files:** Modify `Backend/SorobanSecurityPortalApi.Tests/Services/RatingServiceTests.cs`, `Backend/SorobanSecurityPortalApi.Tests/Controllers/RatingControllerTests.cs`

- [ ] **Step 1:** In the service test ctor, seed the extra DbSets used by new queries (use the existing `CreateDbSetMock` helper). Add fields + setup:
```csharp
_dbMock.Object.Login = CreateDbSetMock(_logins).Object;
_dbMock.Object.UserProfiles = CreateDbSetMock(_profiles).Object;
_dbMock.Object.Protocol = CreateDbSetMock(_protocols).Object;
_dbMock.Object.Auditor = CreateDbSetMock(_auditors).Object;
```
with backing lists `_logins`, `_profiles`, `_protocols`, `_auditors`. Seed a `ProtocolModel { Id = <id used by add/update tests> }` and matching `AuditorModel` so existing AddOrUpdate tests pass entity validation.
- [ ] **Step 2:** Update `GetRatings_Should_NotIncludeUserId_InPublicList` → rename intent to author exposure: seed a `LoginModel { LoginId = X, FullName = "Alice" }`, a rating by X, assert `result[0].AuthorName.Should().Be("Alice")` and that the type has no `Email`/`UserId` (compile-time). Keep `BeOfType<PublicRatingViewModel>()`.
- [ ] **Step 3:** Add `GetMyRating_Returns_Null_When_NotLoggedIn`, `GetMyRating_Returns_Existing`, `GetSummary_Computes_WeightedAverage_With_Reputation`, `AddOrUpdate_Throws_KeyNotFound_When_Entity_Missing`.
- [ ] **Step 4:** In controller tests, add `GetMine_Returns_NoContent_When_Null`, `GetMine_Returns_Ok_When_Found`, `CreateOrUpdate_Returns_404_When_KeyNotFound`.
- [ ] **Step 5:** Run `dotnet test Backend/SorobanSecurityPortal.sln` → all pass.
- [ ] **Step 6:** Commit `test(ratings): cover author names, weighted avg, mine, entity validation`

---

## FRONTEND

### Task 5: API model + client calls

**Files:** Create `UI/src/api/soroban-security-portal/models/rating.ts`; Modify `UI/src/api/soroban-security-portal/soroban-security-portal-api.ts`

- [ ] **Step 1:** Create `rating.ts`:
```ts
export enum RatingEntityType { Protocol = 0, Auditor = 1 }

export interface RatingSummary {
  entityType: RatingEntityType;
  entityId: number;
  averageScore: number;
  weightedAverageScore: number;
  totalReviews: number;
  distribution: Record<string, number>; // "1".."5" -> count
}
export interface PublicRating {
  id: number;
  entityType: RatingEntityType;
  entityId: number;
  score: number;
  review: string;
  createdAt: string;
  authorId: number;
  authorName: string;
}
export interface MyRating {
  id: number; score: number; review: string; createdAt: string;
}
export interface CreateRatingRequest {
  entityType: RatingEntityType;
  entityId: number;
  score: number;
  review: string;
}
```
- [ ] **Step 2:** Add calls to the api client (follow existing `getRestClient().request(...)` pattern, import the types):
```ts
export const getRatingSummaryCall = async (entityType: RatingEntityType, entityId: number): Promise<RatingSummary> => {
  const client = await getRestClient();
  const r = await client.request(`api/v1/ratings/summary?entityType=${entityType}&entityId=${entityId}`, 'GET');
  return r.data as RatingSummary;
};
export const getRatingsCall = async (entityType: RatingEntityType, entityId: number, page = 1): Promise<PublicRating[]> => {
  const client = await getRestClient();
  const r = await client.request(`api/v1/ratings?entityType=${entityType}&entityId=${entityId}&page=${page}`, 'GET');
  return r.data as PublicRating[];
};
export const getMyRatingCall = async (entityType: RatingEntityType, entityId: number): Promise<MyRating | null> => {
  const client = await getRestClient();
  const r = await client.request(`api/v1/ratings/mine?entityType=${entityType}&entityId=${entityId}`, 'GET');
  return r.status === 204 ? null : (r.data as MyRating);
};
export const addOrUpdateRatingCall = async (req: CreateRatingRequest): Promise<void> => {
  const client = await getRestClient();
  await client.request('api/v1/ratings', 'POST', req);
};
export const deleteRatingCall = async (id: number): Promise<void> => {
  const client = await getRestClient();
  await client.request(`api/v1/ratings/${id}`, 'DELETE');
};
```
(Verify `client.request` exposes `.status`; if not, branch on `r.data` being empty.)
- [ ] **Step 3:** Commit `feat(ui): ratings API model + client calls`

### Task 6: RatingStars component

**Files:** Create `UI/src/components/ratings/RatingStars.tsx`

- [ ] **Step 1:** Implement a thin wrapper over MUI `Rating` supporting read-only and interactive modes, half-star precision for read-only display, size prop, and `data-testid`. Use frontend-design skill for visual polish (gold gradient, hover scale).
- [ ] **Step 2:** Commit.

### Task 7: RatingSummaryCard

**Files:** Create `UI/src/components/ratings/RatingSummaryCard.tsx`

- [ ] **Step 1:** Render large average number + `RatingStars` + total count + weighted-average caption; horizontal distribution bars 5→1 with count and percent (MUI `LinearProgress` or styled boxes). Empty state when `totalReviews === 0`.
- [ ] **Step 2:** Commit.

### Task 8: RatingDialog

**Files:** Create `UI/src/components/ratings/RatingDialog.tsx`

- [ ] **Step 1:** MUI `Dialog` with interactive `RatingStars` (required, 1-5), multiline review `TextField` (char counter, max 2000), Submit/Update button (disabled when score 0), Delete button when editing. Prefill from `MyRating`. Surface server errors in an `Alert`.
- [ ] **Step 2:** Commit.

### Task 9: ReviewList

**Files:** Create `UI/src/components/ratings/ReviewList.tsx`

- [ ] **Step 1:** List of reviews: `EntityAvatar entityType="user" entityId={authorId}` + `authorName` + `RatingStars` (read-only) + relative date (`formatDateLong`) + review text rendered as plain text (escaped). "Load more" button when more remain (`summary.totalReviews > loaded`). Skip empty-text reviews' body but still show the score line.
- [ ] **Step 2:** Commit.

### Task 10: useRatings hook + RatingsPanel orchestrator

**Files:** Create `UI/src/components/ratings/useRatings.ts`, `UI/src/components/ratings/RatingsPanel.tsx`, `UI/src/components/ratings/index.ts`

- [ ] **Step 1:** `useRatings(entityType, entityId)` loads summary + first page of reviews + (if authed) my rating; exposes `submit`, `remove`, `loadMore`, `refresh`, loading/error state.
- [ ] **Step 2:** `RatingsPanel` composes `RatingSummaryCard` + a "Rate this protocol/auditor" button (opens `RatingDialog`) + `ReviewList`. When unauthenticated, show a "Log in to leave a rating" prompt instead of the button (use `useAppAuth`). Refresh after submit/delete.
- [ ] **Step 3:** Barrel-export from `index.ts`. Commit.

### Task 11: Mount "Reviews" tab on both detail pages

**Files:** Modify `UI/src/features/pages/regular/protocol-details/protocol-details.tsx`, `UI/src/features/pages/regular/auditor-details/auditor-details.tsx`

- [ ] **Step 1:** Add `{ id: 'reviews', label: 'Reviews', icon: <StarIcon /> }` to each `tabs` array and a matching `{tabValue === N && <RatingsPanel entityType=... entityId={entity.id} />}` block. Import `Star` from `@mui/icons-material`.
- [ ] **Step 2:** `npm -C UI run build` succeeds. Commit `feat(ui): Reviews tab with ratings on protocol & auditor pages`.

### Task 12: Frontend unit tests

**Files:** Create `UI/src/components/ratings/__tests__/*.test.tsx`

- [ ] **Step 1:** Tests: `RatingStars` renders N filled stars; `RatingSummaryCard` shows average + distribution + empty state; `RatingDialog` disables submit at score 0, enforces 2000-char cap, prefills existing; `ReviewList` renders author name + escapes text.
- [ ] **Step 2:** `npm -C UI test` passes. Commit `test(ui): rating component unit tests`.

---

## DEPLOY & VERIFY

### Task 13: Build & deploy to dev (manual, no CI/CD)

- [ ] Docker login with PAT (andreykerchin). Build & push `andreykerchin/soroban-security-portal:issue-78` (context `Backend/`, `-f Backend/Dockerfile`) and `andreykerchin/soroban-security-portal-ui:issue-78` (context `UI/`, `-f UI/Dockerfile`).
- [ ] Determine current dev Helm release/values (`helm --kubeconfig kubeconfig.temp -n <ns> get values`), then `helm upgrade` overriding only the two image tags to `issue-78` (registry `andreykerchin`). Do NOT touch unrelated values/secrets.
- [ ] Watch rollout (`kubectl rollout status`), confirm migration applied (backend logs), `ProductVersion` bump if applicable.

### Task 14: Test on dev (Playwright non-headless + API)

- [ ] API: anonymous `GET /summary` & `GET` reviews; `401` on `POST` without auth; login (admin creds) → `POST` rate → `GET /mine` → update → `DELETE`; `404` POST with bogus entityId; `400` invalid score.
- [ ] Playwright (headed) against https://sorobanshield.ru: open a protocol detail → Reviews tab → summary/distribution render; logged-out shows login prompt; log in → rate (happy path) → review appears with author name+avatar, summary updates → update rating → delete. Edge: empty review (score only), 2000-char review, XSS string `<img src=x onerror=alert(1)>` rendered inert. Repeat key checks on an auditor detail page. Capture screenshots.

### Task 15: PR

- [ ] Open PR to `main` from `issue-78-rating-system`. Human-voice English description: product summary, what was already there (#129/#77) vs what this adds, why each backend addition, testing process with screenshots (happy path + edge cases), and references to #78, related PRs (#148 closed/duplicate, #129 merged backend, #135/#154/#159, #77/#79/#81). No agent/Claude mentions. Do not auto-trigger pipelines.

---

## Self-review notes
- Spec coverage: all #78 acceptance criteria mapped (section UI=Task 7/9/11, average+total=Task 7, distribution=Task 7, dialog=Task 8, existing rating=Task 2/10, update=existing+Task 8, reviews w/ author=Task 2/9, weighted avg=Task 2). ✓
- Non-breaking: GetRatings/GetSummary signatures unchanged; new queries are single-set + harness extended. ✓
- Security: author name only (no email), escaped text, `[Authorize]` writes, entity validation, owner/admin delete. ✓

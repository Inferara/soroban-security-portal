# Protocol & Auditor Rating System — Design Spec

**Issue:** [#78 — Implement Protocol Rating System (1-5 Stars with Review)](https://github.com/Inferara/soroban-security-portal/issues/78)
**Date:** 2026-05-25
**Scope decision:** Full feature, wired for **both Protocol and Auditor** detail pages (user mandate — the backend model is already entity-generic).

## Background

The merged backend from PR #129 (which actually closed #77, not #78) added a generic rating
foundation but **no UI** and a few missing pieces for #78. This spec covers completing the feature
end-to-end without breaking the existing backend or its tests.

### Already in `main` (backend, do not duplicate)
- `rating` table + `RatingModel` (`EntityType` Protocol=0/Auditor=1, `Score` 1-5, `Review`, timestamps).
- `RatingController` @ `/api/v1/ratings`: `GET /summary`, `GET` (paged list), `POST` (upsert, `[Authorize]`), `DELETE/{id}` (`[Authorize]`, owner-or-admin).
- `RatingService` with Redis summary caching + unique constraint (1 rating per user per entity).
- Unit tests: `RatingServiceTests`, `RatingControllerTests`.

### Confirmed facts
- `/api/v1/user/{loginId}/avatar.png` is `[AllowAnonymous]` → safe to render author avatars by id.
- `LoginModel.FullName` is the display name; **email must never be exposed**.
- `UserProfileModel.ReputationScore` exists (LEFT-joinable) → basis for weighted average.
- React escapes text nodes → render review text as plain text (no `dangerouslySetInnerHTML`).

## Approved design decisions
1. **Author info on reviews:** show author display name (`FullName`, fallback `Login`) + public avatar. Reverses #129's anonymization (the enforcing test will be updated to the new intent).
2. **UI placement:** dedicated **"Reviews"** tab on each detail page (alongside Overview / etc.).
3. **Weighted average:** included — return both plain and reputation-weighted average.
4. **Scope:** Protocol **and** Auditor.

## Backend changes (all additive / non-breaking)

### 1. `PublicRatingViewModel` — add author fields
Add `AuthorId` (int) and `AuthorName` (string). No email, no role, nothing else.

### 2. `RatingService.GetRatings` — populate author
Project `rating` LEFT JOIN `login` → set `AuthorId = login.LoginId`, `AuthorName = login.FullName` (fallback `login.Login`, else `"Anonymous"`). Keep return type `List<PublicRatingViewModel>` and the existing signature **unchanged** (tests depend on it). Pagination total comes from `summary.TotalReviews` (no signature change needed).

### 3. New `GET /api/v1/ratings/mine` `[Authorize]`
Query: `entityType`, `entityId`. Returns the caller's `RatingViewModel` or `204 No Content` when absent. Add `IRatingService.GetMyRating(EntityType, int)`.

### 4. Weighted average
Add `WeightedAverageScore` (float) to `RatingSummaryViewModel`. Compute in `GetSummary`:
`weight = 1 + ReputationScore` (missing profile → reputation 0 → weight 1);
`weighted = round(Σ(score·weight) / Σweight, 1)`. When no ratings → 0. Cached object gains a field; old cached blobs deserialize with default 0 and expire within the 10-min TTL (acceptable).

### 5. Entity-existence validation on `POST`
Before upsert, verify the target exists (`Protocol` for Protocol, `Auditor` for Auditor); return `404` otherwise. Prevents orphan ratings. Keeps `[Authorize]`, score range, review length, and one-per-user rules.

### 6. Review content safety
Length cap (2000, already enforced) + React escaping cover XSS. If the existing content-filter service is lightweight/synchronous, run review text through it on submit and reject disallowed content; otherwise rely on cap + escaping (decided during implementation, must not add LLM latency to the write path).

### Backend tests
- Update `GetRatings_Should_NotIncludeUserId_InPublicList` → assert `AuthorName` populated and that no email is present (new intent).
- Add: `GetMyRating` returns own rating / null; weighted-average math; `POST` 404 on missing entity.

## Frontend changes

### API layer
- `UI/src/api/soroban-security-portal/models/rating.ts`: `RatingEntityType` (enum 0/1), `RatingSummary`, `PublicRating`, `MyRating`, `CreateRatingRequest`.
- `soroban-security-portal-api.ts`: `getRatingSummaryCall`, `getRatingsCall`, `getMyRatingCall`, `addOrUpdateRatingCall`, `deleteRatingCall` (follow existing `getRestClient().request(...)` pattern).

### Components (entity-generic) — `UI/src/components/ratings/`
- `RatingStars` — read-only & interactive star control.
- `RatingSummaryCard` — large average, stars, total count, weighted-average note, horizontal distribution bars (5→1, count + %).
- `RatingDialog` — interactive star selector + review textarea (char counter, 2000 cap), prefilled from existing rating; submit/update + delete; auth-gated.
- `ReviewList` — avatar (`EntityAvatar entityType="user"`) + author name + stars + relative date + escaped text; "Load more" pagination using `summary.TotalReviews`.
- `RatingsPanel` — orchestrator composing the above; shows a "Log in to rate" prompt when unauthenticated; refreshes after mutations.
- `useRatings` hook — loads summary/reviews/mine and exposes mutations.

### Mounting
Add a **"Reviews"** tab to `protocol-details.tsx` and `auditor-details.tsx`, rendering
`<RatingsPanel entityType="protocol|auditor" entityId={id} />`. No change to existing tabs/data.

### Design quality
Use the frontend-design skill: polished, modern, interactive (animated/hover stars, clear distribution bars, smooth dialog), consistent with the existing MUI theme and detail-page layout.

### Frontend tests
Vitest unit tests for `RatingStars`, `RatingSummaryCard` (distribution rendering), `RatingDialog` (validation/prefill), `ReviewList` (author rendering).

## Non-breaking & security review
- All backend edits additive; `GetRatings`/`GetSummary` signatures preserved.
- No new PII: only public display name + already-public avatar; email never serialized.
- Review text rendered escaped; no HTML injection.
- Writes stay `[Authorize]`; one-rating-per-user; delete owner/admin only; entity existence validated.
- Weighted-average join is LEFT (default reputation 0); cache shape change tolerated by TTL.

## Deployment & verification
- Build & push `andreykerchin/soroban-security-portal:issue-78` and `andreykerchin/soroban-security-portal-ui:issue-78` (Docker Hub PAT). **No CI/CD pipelines.**
- Deploy to dev (`kubeconfig.temp`, host `sorobanshield.ru`) manually via the existing Helm chart, overriding image tags. Migrations apply automatically on backend startup (existing `UpdateService`).
- Verify with Playwright (non-headless) + API checks: happy path (rate → see summary/distribution/review update → update → delete) and edge cases (unauthenticated, invalid scores, missing entity, empty reviews, long text, XSS attempt in review).
- Then open a PR with a human-voice description + screenshots. Do not push test-only branches separately.

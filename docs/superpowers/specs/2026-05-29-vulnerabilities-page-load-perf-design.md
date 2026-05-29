# Vulnerabilities Page Load Performance — Design

**Date:** 2026-05-29
**Branch:** `perf/report-image-compression`
**Status:** Approved (design)

## Problem

The Vulnerabilities page loads slowly. Systematic measurement (dev + production)
shows the bottleneck is **not** the database — it is per-request server CPU
overhead multiplied across many requests, plus oversized lookup payloads.

### Evidence

- `vulnerability` table: **670 rows, 10 MB**. `EXPLAIN ANALYZE` of the paginated
  search (filter + sort + limit + joins) = **0.44 ms**; the `/total` count =
  **0.43 ms**. Postgres uses a seq scan and is correct to — an index would not
  help and would only slow writes. **DB indexes are ruled out.**
- Browser Resource Timing (HTTP/2, single reused connection — so TLS/TCP are paid
  once, not per call):
  - **Production (weak hardware):** `severities` returns ~0 KB but takes
    **1115 ms**; `tags` 1449 ms; `protocols` 1514 ms TTFB / 2401 ms (272 KB);
    `companies` 1117 ms (127 KB); search **1855 ms** (6 KB body); and
    `vulnerabilities/total` does not even start until **12 020 ms** because the UI
    awaits search then total serially. A ~0 KB response taking 1.1 s proves the
    cost is server CPU per request (Kestrel + DbContext + EF translation +
    serialization) on a weak core, with ~9 concurrent requests contending.
  - **Dev (good hardware):** same shape, smaller numbers (137 ms floor, search
    532 ms, total serialized after).
- Payload bloat source (measured): `protocols` 271 KB is **98.5 % inline base64
  `imageData`** (10 records, one image 106 KB); `companies` 126 KB is **96 %
  inline images**. Those images are already served by the dedicated
  `/{entity}/{id}/image.png` endpoints, so inlining them in the bulk list is pure
  waste.

### Why this matters more on production

Production runs on much weaker hardware than dev. Everything CPU-bound per
request (EF translation, AutoMapper, JSON serialization, TLS) scales with CPU, and
~9 concurrent requests saturate a weak core, so each one slows the others. The
levers are therefore: **(1) stop recomputing/re-serializing the same lookup data
per visitor, (2) make fewer requests, (3) ship smaller payloads.**

## Decisions (locked)

- **Cache store:** in-memory `IMemoryCache` (single replica; zero extra network
  hop; lost on restart and repopulated lazily — acceptable).
- **Freshness:** TTL (default 10 min) **plus** explicit invalidation on write.
- **search + total:** combined into one request; total returned via an
  `X-Total-Count` response header (body stays the items array — backward
  compatible). The standalone `/total` endpoint is kept for other callers.
- **Payload slimming:** null out `ImageData` in bulk `List()` responses (shape
  unchanged); `GetById` keeps full image data.
- No DB indexes.

## Components & changes

### Change 1 — In-memory cache for lookup endpoints

- New helper `ILookupCache` (wraps `IMemoryCache`):
  - `Task<T> GetOrCreateAsync<T>(string key, Func<Task<T>> factory, TimeSpan? ttl = null)`
  - `void Remove(string key)`
  - Registered as a singleton; default TTL 10 minutes.
- Apply cache-aside in the read-heavy lookup service methods, each with a stable
  key:
  - `VulnerabilityService.ListSeverities` → `lookup:severities`
  - `VulnerabilityService.ListSources` → `lookup:sources`
  - `TagService` list → `lookup:tags`
  - `ProtocolService.List` → `lookup:protocols`
  - `CompanyService.List` → `lookup:companies`
  - `AuditorService.List` → `lookup:auditors`
  - `ReportService.GetList()` (public list, used as a lookup) → `lookup:reports`
- Invalidate on write — each entity's mutating operations call
  `_lookupCache.Remove(key)`:
  - Protocol Add/Update/Delete → `lookup:protocols`
  - Company Add/Update/Delete → `lookup:companies`
  - Auditor Add/Update/Delete → `lookup:auditors`
  - Tag add/update/delete → `lookup:tags`
  - Report Add/Approve/Reject/Update/Remove → `lookup:reports`
  - `severities` (static enum) and `sources` (derived) rely on the TTL only.

### Change 2 — Combine search + total

- Service: a combined path returning items **and** total using one `DbContext`
  round (e.g. `Task<(List<VulnerabilityViewModel> Items, int Total)> SearchWithTotal(...)`).
- Controller `Search`: call the combined path, set
  `Response.Headers["X-Total-Count"] = total.ToString()`, return `Ok(items)`.
  The `/total` endpoint stays as-is for backward compatibility.
- UI: `getVulnerabilitiesCall` reads `X-Total-Count` and returns `{ items, total }`;
  the vulnerabilities hook sets list and total from that single call and removes
  the separate `getVulnerabilitiesTotalCall`.

### Change 3 — Stop inlining image bytes in bulk lists

- `ProtocolService.List`, `CompanyService.List`, `AuditorService.List`: set
  `ImageData = null` on each returned item (field present, shape unchanged).
- `GetById` (used by admin edit) keeps full `ImageData`. Images everywhere load
  via the existing `/{entity}/{id}/image.png` endpoints, so the UI is unaffected.

## Data flow

Unchanged contracts. Lookup responses come from RAM after first warm; search
returns its total in a header; bulk lists omit heavy image bytes. The vulnerabilities
page therefore makes fewer, lighter, mostly-cached requests.

## Error handling

- Cache factory failures propagate as today (no cached value stored on exception).
- A cache miss simply recomputes. Invalidation is best-effort and idempotent.
- `X-Total-Count` absent (older clients) → callers fall back to the existing
  `/total` endpoint; the vulnerabilities hook always reads the header on this build.

## Testing

- **Backend unit:** `LookupCache` hit/miss/TTL/eviction; each lookup service
  returns cached results on the second call and re-queries after a write
  invalidation; `protocols`/`companies`/`auditors` `List()` returns null
  `ImageData` while `GetById` retains it; `Search` sets a correct `X-Total-Count`.
- **UI:** the hook issues a single search request and reads `total` from the
  header (no second total call).
- **Dev verification (Playwright, non-headless):** re-measure Resource Timing —
  fewer/lighter calls; filters still populate; admin edit still shows protocol/
  company images; lazy description on card expand still works.

## Out of scope (YAGNI)

- DB indexes.
- The ~916 ms notifications / bookmarks / user-context cluster (a separate global
  per-page cost — noted for a future pass).
- Changing the search response body shape.
- Redis-backed or distributed caching (single replica; in-memory chosen).

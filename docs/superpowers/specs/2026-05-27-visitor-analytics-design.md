# Visitor Analytics — Design Spec

**Issue:** [#171](https://github.com/Inferara/soroban-security-portal/issues/171)
**Date:** 2026-05-27
**Branch:** `feature/visitor-analytics` (based on `origin/main` @ #170)

## Problem

The portal has no in-app, server-side visibility into how much traffic individual
content pages get. The only analytics today is `react-ga4`, which ships pageview/event
hits to **Google Analytics**. That data lives in the Google console — it is not shown on
the pages themselves and not surfaced anywhere in the admin UI. There is no per-page
"how many people viewed this" number and no in-product statistics view.

Issue #171 asks for:
1. A publicly visible, bot-filtered view counter on each report / auditor page.
2. (If sensible) surfacing the link-preview / crawler activity that PR #120 introduced.
3. A new **Statistics** page in the Admin UI.

## Scope (agreed)

- **Track + show a public counter on all four public detail pages:** Report, Auditor,
  Vulnerability, Protocol.
- **Store both raw view events and compute unique counts.**
- **Crawler / link-preview hits** are counted and shown **admin-only** (not on public pages).

Out of scope: replacing or reconfiguring Google Analytics; tracking list/search pages;
extending OpenGraph crawler routing to new entity types.

## Non-duplication & safety analysis

- **Not a duplicate of GA.** GA is client→Google, invisible in-app. This feature is a
  server-side counter stored in our own DB, shown on-page and in the admin UI. They are
  complementary. No GA code is touched.
- **Almost entirely additive.** New DB table, new service/processor, new controller, new
  admin page. The only edits to existing code are: `Db` (one `DbSet`), `OgController`
  (one best-effort recording call), the four public detail hooks (fire view + read count),
  and the admin menu/routes registration.
- **Migration is additive** (single new table) so it applies cleanly even though the dev
  database is further ahead than some branches. It is generated with `dotnet ef migrations
  add` so it ships **with** its `.Designer.cs` and an updated `DbModelSnapshot` — avoiding
  the broken-migration defect seen in earlier PRs (#115/#129/#134).
- **No PII stored.** We never store a raw IP address. Uniqueness uses a salted SHA-256 of
  `IP + User-Agent + UTC-date`. This is deliberately mindful of the prior #125 PII finding.
- **Abuse resistance.** The public `POST /view` endpoint must be unauthenticated (anonymous
  visitors need to be counted). The unique metric is robust against reload/refresh inflation
  because it dedupes on the per-day visitor hash; raw total is acknowledged as inflatable and
  is treated as the softer number. Bots are filtered three ways (below).

## Bot filtering (defense in depth)

1. **nginx** already routes known crawler User-Agents on `/report/{id}` and
   `/vulnerability/{id}` to the internal OG endpoint, so those crawlers never load the SPA
   and never reach the Human view path.
2. The **Human** view is recorded by **client-side JS on mount** — crawlers that don't
   execute JavaScript can't trigger it.
3. A **server-side User-Agent check** on `POST /view` is the backstop: requests whose UA
   matches the known-bot list are recorded as `source = Crawler` (or skipped) so they never
   inflate the human numbers.

## Data model

New table `page_view`:

| column | type | notes |
|---|---|---|
| `id` | int, identity | PK |
| `entity_type` | int | enum `PageViewEntityType`: Report=1, Auditor=2, Vulnerability=3, Protocol=4 |
| `entity_id` | int | id of the viewed entity |
| `viewed_at` | timestamptz | UTC; powers "views over time" |
| `visitor_hash` | varchar(64) | salted SHA-256(`ip` + `ua` + `yyyy-MM-dd`); **no raw PII** |
| `source` | int | enum `PageViewSource`: Human=1, Crawler=2 |

Indexes: `(entity_type, entity_id)`, `(viewed_at)`.

- **Total views** = `COUNT(*)`. **Unique views** = `COUNT(DISTINCT visitor_hash)`.
- A view is **deduped on insert within a day**: if a row with the same
  `(entity_type, entity_id, visitor_hash, source)` for today's date already exists, skip the
  insert. (So one visitor reloading within 24h adds at most one Human row per entity per day —
  keeping "total" meaningful while still allowing day-over-day growth.)

## Backend components

- `Models/DbModels/PageViewModel.cs` + enums `PageViewEntityType`, `PageViewSource`.
- `Db.cs`: `public DbSet<PageViewModel> PageView { get; set; }` (+ index config in `OnModelCreating`).
- `Services/.../IPageViewProcessor` + `PageViewProcessor`: EF data access — `RecordAsync`,
  `GetCountsAsync(type,id)` → `{total,unique}`, and aggregation queries for the admin stats.
- `Services/.../IPageViewService` + `PageViewService`: builds the salted hash from the request's
  IP+UA, runs the server-side bot UA check, applies day-dedup, delegates to the processor;
  exposes `RecordView`, `GetCounts`, `GetStatistics`. Registered automatically by the existing
  `I*Service` / `I*Processor` convention scan.
- `Common`: a small shared `BotUserAgent` helper holding the same crawler UA list nginx uses,
  so the server-side check stays in sync conceptually.
- `Controllers/AnalyticsController.cs`, route `api/v1/analytics`:
  - `POST view` — body `{ entityType, entityId }` — **public**. Reads IP+UA server-side
    (client cannot influence the hash), records a Human (or Crawler, if UA is a bot) view.
    Returns 200. Validates `entityType`/`entityId`.
  - `GET view/{entityType:int}/{entityId:int}` — **public**. Returns `{ total, unique }`.
  - `GET statistics` — `[RoleAuthorize(Role.Admin, Role.Moderator)]`. Returns the dashboard
    aggregate (totals, per-type top entities, crawler/share count, daily series).
- `OgController`: in `Vulnerability(id)` and `Report(id)`, after deciding to serve rich tags,
  fire a best-effort `try/catch` `RecordView(..., source: Crawler)`. Must never block or fail
  the OG response.

## UI components

- `api/.../soroban-security-portal-api.ts`: `recordPageViewCall(entityType, entityId)`,
  `getPageViewCountCall(entityType, entityId)`, `getAnalyticsStatisticsCall()`. Types in
  `api/.../models/analytics.ts`.
- Each of the four detail hooks (`report-details.hook`, `auditor-details.hook`,
  `vulnerability-details.hook`, `protocol-details.hook`): on mount, fire `recordPageView` once
  (guarded so it fires a single time) and fetch the count. Existing `ReactGA.event` calls are
  left untouched.
- A **"Views" `StatisticsCard`** added to each detail page, showing total views (with unique
  in a tooltip), matching the existing cards' look.
- New admin page `features/pages/admin/statistics/statistics.tsx` + `hooks/useStatistics.ts`:
  - Route `${basePath}/admin/statistics` in `admin-main-window.tsx`.
  - Menu item (e.g. `QueryStatsIcon`, visible to Admin+Moderator) in `admin-left-menu.tsx`.
  - Content: `StatisticsCards` (total human views, unique visitors, link-preview/crawler
    shares), top-viewed entities per type, and a views-over-time `LineChart` (`@mui/x-charts`).
  - Standard `CurrentPageState` Redux registration like other admin pages.

## Testing strategy

- **Backend (xUnit + Moq + FluentAssertions):**
  - `PageViewService`: same visitor+day dedupes; bot UA recorded as Crawler / excluded from
    human counts; hash is stable for same inputs and differs across days; no raw IP retained.
  - `AnalyticsController`: validation, public endpoints return counts, `statistics` is role-gated.
  - `OgController`: crawler recording is invoked and a recording failure does not break the OG html.
- **UI (vitest + Testing Library):** the three api calls; the Views card renders a count; the
  Statistics page renders cards/series from mocked data.
- **Playwright (non-headless) on dev + API checks:**
  - Happy path: open each of the four detail pages → counter visible; admin Statistics page
    renders real numbers; OG endpoint hit with a crawler UA increments the share count.
  - Edge cases: reload keeps **unique** stable while **total** grows within limits; a request
    with a bot UA does not raise human counts; unauthenticated `GET /statistics` is rejected;
    invalid `entityType`/`entityId` handled gracefully.

## Deployment (dev only, manual — no CI/CD)

- Build API + UI images, tag `andreykerchin/soroban-security-portal:issues171` and
  `andreykerchin/soroban-security-portal-ui:issues171`, push to the `andreykerchin` Docker Hub.
- Bump `appsettings.json` `ProductVersion` above dev's current value so the additive migration
  runs on deploy (verify dev's live value first).
- `helm upgrade ... --reuse-values --set ...service.tag=issues171` against the
  `sorobansecurityportal-ns` namespace via `kubeconfig.temp`. Verify migration applied and the
  feature works live at https://sorobanshield.ru. Do **not** trigger any pipeline.

## Success criteria

- A logged-out visitor opening any of the four detail pages sees a "Views" number that
  increments for genuine human visits and ignores bots.
- The admin Statistics page shows totals, unique visitors, top content, link-preview/crawler
  shares, and a time series.
- No regression to existing pages, OG link previews, or GA.
- PR has no merge conflicts and no unresolved review comments.

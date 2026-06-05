# Report summary card for social/link previews

**Date:** 2026-06-05
**Branch:** feature/new-work
**Status:** Approved

## Problem

When a `/report/{id}` link is shared and unfurled by a social/link-preview crawler
(Discord, X, Slack, LinkedIn), the preview image is the report's PDF cover page. Dominik
asked that the preview instead show a **report summary** — the vulnerability statistics
that already appear on the report page (Total / Fixed / Not Fixed / Fixed Rate).

Crawlers do not run JavaScript, so they never see the SPA. The UI nginx already routes
known crawler User-Agents on `/report/{id}` to `OgController`, which emits server-rendered
OpenGraph/Twitter meta tags. Today `og:image` for an approved report points at the PDF
cover (`/api/v1/reports/{id}/image.png`), falling back to the logo. This change replaces
that image with a generated stats card.

## Decisions (from brainstorming)

- **Scope:** Only the `og:image`/`twitter:image` in the social link-preview card for
  `/report/{id}`. The on-page report UI is unchanged (it already shows this card).
- **Fallback:** Always use the summary card for an approved report — the PDF cover is no
  longer used in OG. A report with zero vulnerabilities still gets a card (`0 / 0 / 0`,
  Fixed Rate `—`). Missing or unapproved reports keep the existing `Generic()` path (logo).
- **Card content:** report name + auditor + the 4 stats + branding (logo), 1200×630.
- **Generation:** rendered on-the-fly as a raster PNG and disk-cached. Not pre-generated
  into the DB.

### Approach vs alternatives

Chosen: render a raster **PNG server-side with SkiaSharp**, on-the-fly, disk-cached.
SkiaSharp is already present transitively via the `PDFtoImage` package.

- SVG as `og:image` — rejected: Twitter/Facebook do not render SVG previews.
- Headless-browser render — rejected: heavy runtime dependency.
- Pre-generate into the DB at approve/edit — rejected: staleness when vulnerabilities
  change, plus migration/storage overhead. On-the-fly + cache keeps numbers always fresh.

## Stat semantics

Mirror `UI/src/.../report-details/report-details.tsx` exactly so the card matches the
on-page card:

- `Fixed` = count of category `Valid` (0)
- `NotFixed` = count of `ValidNotFixed` (1) + `ValidPartiallyFixed` (2)
- `FixedRate` = `round(Fixed / (Fixed + NotFixed) * 100)`, `0` when denominator is `0`
- `Total` = total vulnerabilities returned by the public search for the report

`VulnerabilityCategory`: `Valid=0, ValidNotFixed=1, ValidPartiallyFixed=2, Invalid=3, NA=100`.

The source list is `IVulnerabilityService.Search({ reports: [report.Name], pageSize: -1 })`
— the same query the report page uses, so hidden/soft-deleted vulnerabilities are already
excluded and the card numbers equal the page numbers.

## Components

Each unit has one purpose, a clear interface, and is testable in isolation.

### 1. `ReportSummaryStats` (DTO)

```
ReportName   : string
AuditorName  : string?      // null/empty => auditor line omitted
Total        : int
Fixed        : int
NotFixed     : int
FixedRate    : int          // percent, 0..100
Signature    : string       // cache/ETag key, see below
```

`Signature` = stable hash of `reportId + report.LastModified.Ticks + Total + Fixed +
NotFixed + AuditorName`. Any change that affects the rendered card changes the signature.

### 2. Stats computation

A method (on `ReportService`, or a small `ReportSummaryService`) that:
1. loads the report (name, auditorId, last-modified) — cheap, no heavy columns,
2. resolves auditor name,
3. runs the vulnerability search by report name,
4. computes the counts above and the signature,
5. returns `ReportSummaryStats`, or `null` if the report is missing/unapproved.

### 3. `IReportSummaryCardRenderer`

Pure renderer: `ReportSummaryStats -> byte[]` PNG at **1200×630**.

- Uses SkiaSharp.
- Loads a bundled TTF (embedded resource in the API project) via `SKTypeface.FromStream`
  so text renders in the container regardless of installed system fonts.
- Draws icons as simple vector glyphs (no emoji/system-font dependency).
- Deterministic: same stats -> same bytes.

Layout (1200×630):

```
+-----------------------------------------------------------+
|  [logo]  STELLAR SECURITY PORTAL                          |
|                                                           |
|  <report name, wraps, max 2 lines, ellipsis>             |
|  Security audit by <auditor>          (omitted if none)  |
|                                                           |
|    48          42          6           88%               |
|   Total       Fixed     Not Fixed    Fixed Rate          |
+-----------------------------------------------------------+
```

Brand colors from the app theme. Empty report -> `0 / 0 / 0`, Fixed Rate `—`.

### 4. `IReportSummaryCardService`

Orchestrates and caches, mirroring the existing `ReportImageService` pattern:
1. get `ReportSummaryStats` (null -> return null),
2. build ETag from `Signature`,
3. on-disk cache keyed by `report-{id}-{signature}.png` (atomic write, rebuildable,
   never touches heavy DB columns),
4. render on cache miss,
5. return `(bytes, ETag, LastModified)`.

### 5. Endpoint `GET /api/v1/og/report/{id}/summary.png`

In `OgController`. Mirrors `ReportsController.GetImage`:
- cheap stats query first,
- set `ETag`, `Last-Modified`, `Cache-Control: public, max-age=3600`,
- honor `If-None-Match` with `304`,
- return `image/png`, or `NotFound` for missing/unapproved reports.

### 6. `OgController.Report` change

For an approved report, `og:image`/`twitter:image` always become
`{AppUrl}/og/report/{id}/summary.png`. The PDF-cover branch is removed from the OG path.
Missing/unapproved reports still return `Generic()` (logo), unchanged.

## Testing

- **Renderer unit test:** returns a valid PNG, 1200×630; deterministic for identical stats;
  handles long report names and the no-auditor / zero-vuln cases without throwing.
- **Stats unit test:** category -> fixed/notfixed/rate mapping, including the zero-vuln
  edge (rate `0`/displayed `—`).
- **`OgControllerTests`:** approved report emits the `summary.png` `og:image`; unapproved
  report -> `Generic()`/logo; `304` returned on a matching `If-None-Match`.

## Deploy notes

- Add explicit `SkiaSharp` + `SkiaSharp.NativeAssets.Linux` PackageReferences pinned to the
  version `PDFtoImage` resolves, so the native libs are guaranteed in the runtime image.
- Bundle one TTF as an embedded resource (e.g. DejaVu Sans / Inter). No Dockerfile font
  install required.
- The disk cache reuses the existing report-image cache directory config pattern
  (`ReportImageCacheDir`), or a sibling dir.

## Out of scope

- Severity breakdown on the card (possible later iteration).
- Changing `og:image` for vulnerabilities (separate from this request).
- Any change to the on-page report UI.

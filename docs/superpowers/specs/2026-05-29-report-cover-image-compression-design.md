# Report Cover Image Compression — Design

**Date:** 2026-05-29
**Branch:** `perf/report-image-compression`
**Status:** Approved (design)

## Problem

Report cover images are generated at far higher resolution than they are ever
displayed, and stored as PNG quality 100. This wastes database storage and
client bandwidth.

### Evidence (measured against production, 10 random covers of 58 reports)

| Metric | Value |
|---|---|
| Stored resolution | 2480×3508 / 2550×3299 px (A4/Letter at ~300 DPI) |
| Average weight | ~1.3 MB |
| Maximum weight | 4.85 MB (single report) |
| Format | PNG, quality 100 |
| Estimated total for ~58 covers | ~75 MB |

Actual display sizes:

| Surface | Rendered size |
|---|---|
| Public Reports grid (`reports.tsx`) | 150px tall |
| Admin list (`list-reports.tsx`) | 440px tall, modal max 40vw/40vh |
| OpenGraph card (`OgController`) | ~1200×630 recommended |
| `EntityAvatar` (if used for reports) | 32–80px circle |

The image is ~8× oversized per side (~60× by area) versus the largest real
display, plus PNG is a poor codec for a rendered document page. There is large
headroom: a target of ~40–70 KB per cover is realistic — a ~20–40× reduction.

## Generation point & serving path (current)

- Single generation point: `ReportService.RenderFirstPageAsPng(file, dpi: 150)`
  encoding `SKEncodedImageFormat.Png, 100`. Called from `ReportService.Add` and
  `ReportService.Update`.
- `Report.Image` column is `byte[]?`.
- Public endpoint `GET /api/v1/reports/{id}/image.png` (`ReportsController.GetImage`):
  reads `Image` via `ReportProcessor.GetImageBytes`, keeps a rebuildable on-disk
  cache keyed `report-{id}-{LastActionAt.Ticks}.png`, returns `File(bytes, "image/png")`.
  ETag is `"r{id}-{LastActionAt.Ticks}"` with `Cache-Control: public, max-age=3600`
  and conditional-request (304) support.
- `OgController.Report` emits `og:image = {AppUrl}/reports/{id}/image.png` when
  `Image` is non-empty, else falls back to the site logo.

**Key constraint:** both the ETag and the on-disk cache filename are derived from
`LastActionAt.Ticks`. Regenerating `Image` without changing `LastActionAt` would
leave the stale cached copy (and browser/CDN caches) in place. The backfill must
bump `LastActionAt`.

## Decisions (locked)

- **Format:** WebP.
- **Scope:** both new uploads (generation code) and existing 58 covers (backfill).
- **Target resolution:** ≤ ~1000px on the long side (e.g. ~707×1000 for A4).
  Crisp at 2× retina of the 440px admin display, covers og:image; expected
  ~40–70 KB.
- **Backfill trigger:** admin-only endpoint, run manually after deploy.
- **WebP quality:** ~80 (good quality for document pages, large size win).

## Components & changes

### 1. New helper: `ReportCoverImage` (Common/DataParsers)

Pure static function, unit-testable in isolation:

```
byte[] RenderCoverWebp(byte[] pdf, int maxDim = 1000, int quality = 80)
```

- Render first PDF page via `PDFtoImage.Conversion.ToImage`.
- Downscale with `SKBitmap.Resize` so `max(width, height) <= maxDim`, preserving
  aspect ratio. Never upscale (if already smaller, keep as-is).
- Encode `SKImage.Encode(SKEncodedImageFormat.Webp, quality)`.

### 2. `ReportService.Add` / `ReportService.Update`

Call `ReportCoverImage.RenderCoverWebp(...)` instead of `RenderFirstPageAsPng`.
Remove the old `RenderFirstPageAsPng` method.

### 3. Serving path

- `ReportsController.GetImage`: change response content type to `image/webp`.
- `ReportImageService.CacheFilePath`: change the on-disk cache extension to
  `.webp`.
- The URL path `…/image.png` stays unchanged (cosmetic; browsers and crawlers
  honor `Content-Type`, not the extension). This avoids edits across multiple UI
  call sites and `OgController`.

### 4. Backfill admin endpoint

`POST /api/v1/reports/recompress-images` with `[RoleAuthorize(Role.Admin)]`:

- Iterate every report that has a non-empty `BinFile`, **one at a time** (do not
  load all PDFs into memory at once).
- Regenerate the cover via `ReportCoverImage.RenderCoverWebp`, write `Image`, and
  bump `LastActionAt = UtcNow` (busts ETag + on-disk + browser/CDN caches).
- Idempotent — safe to re-run.
- Return a summary: `{ processed, skipped, failed, bytesBefore, bytesAfter }`.

New `ReportProcessor` members:

- A query returning report ids that have a non-empty `BinFile`.
- `UpdateImage(int reportId, byte[] image)` that writes `Image` and bumps
  `LastActionAt`.

## Data flow

Unchanged. Only the stored/served bytes shrink and the format changes from PNG to
WebP. ETag caching and HTTP 304 continue to work.

## Edge cases

- Report with no `BinFile` (failed/legacy URL upload) → skipped in backfill,
  `Image` left untouched.
- PDF render failure → caught, counted as `failed`, loop continues.
- WebP of a mostly-white text page → very small; fine.
- Stale browser/CDN caches → busted by the ETag change on backfill; new uploads
  are naturally new.
- `og:image` as WebP → accepted by current major social crawlers
  (Facebook/X/LinkedIn/Telegram/Slack/Discord); logo fallback unaffected.

## Testing

- **Unit (`ReportCoverImage`):** output has WebP signature (`RIFF`…`WEBP`),
  `max(width, height) <= 1000`, aspect ratio preserved, output noticeably smaller
  than the source PNG render. Never upscales an already-small input.
- **Endpoint:** `GetImage` returns `Content-Type: image/webp`. Update existing
  `ReportImageServiceTests` / `ReportsControllerImageTests` for the `.webp`
  extension and content type.
- **Backfill:** idempotency, skips null-`BinFile` reports, bumps `LastActionAt`,
  returns correct summary counts.

## Out of scope (YAGNI)

- On-the-fly multiple sizes / responsive `srcset`.
- CDN configuration.
- Renaming the route to `image.webp`.
- Auditor/protocol/company/user avatars share the same oversizing problem but go
  through different endpoints/services — a possible follow-up, not part of this
  change.

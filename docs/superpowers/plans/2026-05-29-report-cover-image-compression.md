# Report Cover Image Compression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Shrink report cover images ~20–40× by rendering them resized (≤1000px long side) and encoded as WebP q80, for both new uploads and the 58 existing covers.

**Architecture:** A single pure helper (`ReportCoverImage`) does resize + WebP encode; `ReportService.Add/Update` call it on upload; the public image endpoint serves `image/webp`; an admin-only endpoint re-renders existing covers from their stored PDF and bumps `LastActionAt` to bust caches.

**Tech Stack:** ASP.NET Core (net10.0), SkiaSharp (3.x, transitive via PDFtoImage 5.2.1), PDFtoImage, EF Core, xUnit + FluentAssertions + Moq.

**Spec:** `docs/superpowers/specs/2026-05-29-report-cover-image-compression-design.md`

---

## File Structure

- **Create:** `Backend/SorobanSecurityPortalApi/Common/DataParsers/ReportCoverImage.cs` — pure resize+WebP encode helper and a thin PDF-render wrapper.
- **Create:** `Backend/SorobanSecurityPortalApi/Models/ViewModels/RecompressImagesResultViewModel.cs` — backfill summary DTO.
- **Create:** `Backend/SorobanSecurityPortalApi.Tests/Common/DataParsers/ReportCoverImageTests.cs` — unit tests for the helper.
- **Create:** `Backend/SorobanSecurityPortalApi.Tests/Controllers/ReportsControllerRecompressTests.cs` — endpoint test.
- **Modify:** `Backend/SorobanSecurityPortalApi/Services/ControllersServices/ReportService.cs` — use helper in `Add`/`Update`, remove `RenderFirstPageAsPng`, add `RecompressAllImages`, extend `IReportService`.
- **Modify:** `Backend/SorobanSecurityPortalApi/Services/ControllersServices/ReportImageService.cs` — cache file extension `.png` → `.webp`.
- **Modify:** `Backend/SorobanSecurityPortalApi/Controllers/ReportsController.cs` — `image/webp` content type, add recompress endpoint.
- **Modify:** `Backend/SorobanSecurityPortalApi/Data/Processors/ReportProcessor.cs` — add `GetReportIdsWithBinFile`, `UpdateImage`, extend `IReportProcessor`.
- **Modify:** `Backend/SorobanSecurityPortalApi.Tests/Services/ReportImageServiceTests.cs` — assert `.webp` cache file.
- **Modify:** `Backend/SorobanSecurityPortalApi.Tests/Controllers/ReportsControllerImageTests.cs` — assert `image/webp`.

**Build/test commands** (run from repo root `C:/Projects/My/soroban-security-portal`):
- Build: `dotnet build Backend/SorobanSecurityPortalApi.Tests/SorobanSecurityPortalApi.Tests.csproj`
- Run all tests: `dotnet test Backend/SorobanSecurityPortalApi.Tests/SorobanSecurityPortalApi.Tests.csproj`
- Run a single test: `dotnet test Backend/SorobanSecurityPortalApi.Tests/SorobanSecurityPortalApi.Tests.csproj --filter "FullyQualifiedName~ReportCoverImageTests"`

---

## Task 1: `ReportCoverImage` helper (resize + WebP encode)

**Files:**
- Create: `Backend/SorobanSecurityPortalApi/Common/DataParsers/ReportCoverImage.cs`
- Test: `Backend/SorobanSecurityPortalApi.Tests/Common/DataParsers/ReportCoverImageTests.cs`

The helper is split in two so the compression logic is testable without a real PDF:
`ResizeAndEncodeWebp(SKBitmap, …)` is pure and unit-tested; `RenderCoverWebp(byte[] pdf, …)`
is a thin wrapper around `PDFtoImage.Conversion.ToImage` (exercised via manual verification in Task 7).

- [ ] **Step 1: Write the failing test**

Create `Backend/SorobanSecurityPortalApi.Tests/Common/DataParsers/ReportCoverImageTests.cs`:

```csharp
using SkiaSharp;
using SorobanSecurityPortalApi.Common.DataParsers;
using Xunit;

namespace SorobanSecurityPortalApi.Tests.Common.DataParsers
{
    public class ReportCoverImageTests
    {
        private static SKBitmap MakeBitmap(int width, int height)
        {
            var bmp = new SKBitmap(width, height);
            using var canvas = new SKCanvas(bmp);
            canvas.Clear(SKColors.White);
            using var paint = new SKPaint { Color = SKColors.SteelBlue };
            canvas.DrawRect(10, 10, width / 2f, height / 2f, paint);
            using var paint2 = new SKPaint { Color = SKColors.DarkRed };
            canvas.DrawRect(width / 3f, height / 3f, width / 2f, height / 2f, paint2);
            return bmp;
        }

        private static bool IsWebp(byte[] bytes) =>
            bytes.Length > 12 &&
            bytes[0] == (byte)'R' && bytes[1] == (byte)'I' && bytes[2] == (byte)'F' && bytes[3] == (byte)'F' &&
            bytes[8] == (byte)'W' && bytes[9] == (byte)'E' && bytes[10] == (byte)'B' && bytes[11] == (byte)'P';

        [Fact]
        public void ResizeAndEncodeWebp_DownscalesLargeImage_PreservingAspect()
        {
            using var source = MakeBitmap(2000, 3000);

            var webp = ReportCoverImage.ResizeAndEncodeWebp(source, maxDim: 1000, quality: 80);

            IsWebp(webp).Should().BeTrue();
            using var decoded = SKBitmap.Decode(webp);
            Math.Max(decoded.Width, decoded.Height).Should().BeLessThanOrEqualTo(1000);
            decoded.Width.Should().Be(667);   // round(2000 * 1000/3000)
            decoded.Height.Should().Be(1000);
        }

        [Fact]
        public void ResizeAndEncodeWebp_DoesNotUpscaleSmallImage()
        {
            using var source = MakeBitmap(500, 700);

            var webp = ReportCoverImage.ResizeAndEncodeWebp(source, maxDim: 1000, quality: 80);

            IsWebp(webp).Should().BeTrue();
            using var decoded = SKBitmap.Decode(webp);
            decoded.Width.Should().Be(500);
            decoded.Height.Should().Be(700);
        }

        [Fact]
        public void ResizeAndEncodeWebp_ProducesSmallerOutputThanSourcePng()
        {
            using var source = MakeBitmap(2000, 3000);
            using var srcImage = SKImage.FromBitmap(source);
            using var srcPng = srcImage.Encode(SKEncodedImageFormat.Png, 100);
            var pngBytes = srcPng.ToArray();

            var webp = ReportCoverImage.ResizeAndEncodeWebp(source, maxDim: 1000, quality: 80);

            webp.Length.Should().BeLessThan(pngBytes.Length);
        }
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `dotnet test Backend/SorobanSecurityPortalApi.Tests/SorobanSecurityPortalApi.Tests.csproj --filter "FullyQualifiedName~ReportCoverImageTests"`
Expected: FAIL — compile error, `ReportCoverImage` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `Backend/SorobanSecurityPortalApi/Common/DataParsers/ReportCoverImage.cs`:

```csharp
using PDFtoImage;
using SkiaSharp;

namespace SorobanSecurityPortalApi.Common.DataParsers
{
    // Renders a report's PDF first page into a compact WebP cover. The previous approach stored a
    // full-resolution (~300 DPI, ~1-5 MB) PNG that was only ever displayed at <=440px; this resizes
    // to a sane long-side bound and encodes WebP, cutting size ~20-40x.
    public static class ReportCoverImage
    {
        public const int DefaultMaxDimension = 1000;
        public const int DefaultQuality = 80;

        // Renders the first page of the PDF and returns a resized WebP cover.
        public static byte[] RenderCoverWebp(byte[] pdf, int maxDim = DefaultMaxDimension, int quality = DefaultQuality)
        {
            using var bitmap = Conversion.ToImage(pdf, 0);
            return ResizeAndEncodeWebp(bitmap, maxDim, quality);
        }

        // Pure: downscales so the long side is <= maxDim (never upscales) and encodes WebP.
        public static byte[] ResizeAndEncodeWebp(SKBitmap source, int maxDim = DefaultMaxDimension, int quality = DefaultQuality)
        {
            var longSide = Math.Max(source.Width, source.Height);
            SKBitmap toEncode = source;
            SKBitmap? resized = null;

            if (longSide > maxDim)
            {
                var scale = (double)maxDim / longSide;
                var newWidth = Math.Max(1, (int)Math.Round(source.Width * scale));
                var newHeight = Math.Max(1, (int)Math.Round(source.Height * scale));
                resized = source.Resize(
                    new SKImageInfo(newWidth, newHeight),
                    new SKSamplingOptions(SKCubicResampler.Mitchell));
                toEncode = resized ?? source;
            }

            using (var image = SKImage.FromBitmap(toEncode))
            using (var data = image.Encode(SKEncodedImageFormat.Webp, quality))
            {
                var bytes = data.ToArray();
                resized?.Dispose();
                return bytes;
            }
        }
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `dotnet test Backend/SorobanSecurityPortalApi.Tests/SorobanSecurityPortalApi.Tests.csproj --filter "FullyQualifiedName~ReportCoverImageTests"`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add Backend/SorobanSecurityPortalApi/Common/DataParsers/ReportCoverImage.cs Backend/SorobanSecurityPortalApi.Tests/Common/DataParsers/ReportCoverImageTests.cs
git commit -m "Add ReportCoverImage helper: resize + WebP encode"
```

---

## Task 2: Use the helper on upload (Add/Update) and remove the old PNG path

**Files:**
- Modify: `Backend/SorobanSecurityPortalApi/Services/ControllersServices/ReportService.cs`

- [ ] **Step 1: Add the using and switch `Add` to the helper**

In `ReportService.cs`, add to the usings block (near the other `SorobanSecurityPortalApi.Common.*` usings):

```csharp
using SorobanSecurityPortalApi.Common.DataParsers;
```

In `Add` (currently line ~67), replace:

```csharp
            reportModel.Image = reportModel.BinFile != null ? RenderFirstPageAsPng(reportModel.BinFile, dpi: 150) : null;
```

with:

```csharp
            reportModel.Image = reportModel.BinFile != null ? ReportCoverImage.RenderCoverWebp(reportModel.BinFile) : null;
```

- [ ] **Step 2: Switch `Update` to the helper**

In `Update` (currently line ~82), replace:

```csharp
                reportModel.Image = RenderFirstPageAsPng(reportModel.BinFile, dpi: 150);
```

with:

```csharp
                reportModel.Image = ReportCoverImage.RenderCoverWebp(reportModel.BinFile);
```

- [ ] **Step 3: Remove the now-unused `RenderFirstPageAsPng` method**

Delete the entire private method (currently lines ~95–103):

```csharp
        private static byte[] RenderFirstPageAsPng(byte[] file, int dpi = 150)
        {
            var bitmap = Conversion.ToImage(file, 0);
            using (var image = SKImage.FromBitmap(bitmap))
            using (var data = image.Encode(SKEncodedImageFormat.Png, 100))
            {
                return data.ToArray();
            }
        }
```

If, after deletion, the `using PDFtoImage;`, `using SkiaSharp;`, and `using Pgvector;` lines are no longer referenced elsewhere in the file, leave `Pgvector` (still used by `new Vector(...)`) and remove `PDFtoImage` / `SkiaSharp` only if the build warns they are unused. (The build in Step 4 will confirm.)

- [ ] **Step 4: Build to verify it compiles**

Run: `dotnet build Backend/SorobanSecurityPortalApi/SorobanSecurityPortalApi.csproj`
Expected: Build succeeded, 0 errors. (Resolve any "unused using" warnings per Step 3.)

- [ ] **Step 5: Commit**

```bash
git add Backend/SorobanSecurityPortalApi/Services/ControllersServices/ReportService.cs
git commit -m "Generate report covers as WebP on upload"
```

---

## Task 3: Serve `image/webp` and cache as `.webp`

**Files:**
- Modify: `Backend/SorobanSecurityPortalApi/Controllers/ReportsController.cs:100`
- Modify: `Backend/SorobanSecurityPortalApi/Services/ControllersServices/ReportImageService.cs:71`
- Modify: `Backend/SorobanSecurityPortalApi.Tests/Controllers/ReportsControllerImageTests.cs:79`
- Modify: `Backend/SorobanSecurityPortalApi.Tests/Services/ReportImageServiceTests.cs:65`

- [ ] **Step 1: Update the existing tests to expect WebP (failing first)**

In `ReportsControllerImageTests.cs`, in `GetImage_ReturnsFileWithHeaders_OnCacheMiss`, change:

```csharp
            Assert.Equal("image/png", file.ContentType);
```

to:

```csharp
            Assert.Equal("image/webp", file.ContentType);
```

In `ReportImageServiceTests.cs`, in `GetImageContentAsync_ReadsFromDbThenCachesFile`, change:

```csharp
            File.Exists(Path.Combine(_cacheDir, $"report-7-{ts.Ticks}.png")).Should().BeTrue();
```

to:

```csharp
            File.Exists(Path.Combine(_cacheDir, $"report-7-{ts.Ticks}.webp")).Should().BeTrue();
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `dotnet test Backend/SorobanSecurityPortalApi.Tests/SorobanSecurityPortalApi.Tests.csproj --filter "FullyQualifiedName~ReportsControllerImageTests|FullyQualifiedName~ReportImageServiceTests"`
Expected: FAIL — `GetImage_ReturnsFileWithHeaders_OnCacheMiss` (expected image/webp) and `GetImageContentAsync_ReadsFromDbThenCachesFile` (`.webp` file not found).

- [ ] **Step 3: Update the controller content type**

In `ReportsController.cs`, in `GetImage`, change (line ~100):

```csharp
            return File(content.Bytes, "image/png");
```

to:

```csharp
            return File(content.Bytes, "image/webp");
```

- [ ] **Step 4: Update the cache filename extension**

In `ReportImageService.cs`, in `CacheFilePath`, change (line ~71):

```csharp
            return Path.Combine(dir, $"report-{reportId}-{utc.Ticks}.png");
```

to:

```csharp
            return Path.Combine(dir, $"report-{reportId}-{utc.Ticks}.webp");
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `dotnet test Backend/SorobanSecurityPortalApi.Tests/SorobanSecurityPortalApi.Tests.csproj --filter "FullyQualifiedName~ReportsControllerImageTests|FullyQualifiedName~ReportImageServiceTests"`
Expected: PASS (all tests in both classes).

- [ ] **Step 6: Commit**

```bash
git add Backend/SorobanSecurityPortalApi/Controllers/ReportsController.cs Backend/SorobanSecurityPortalApi/Services/ControllersServices/ReportImageService.cs Backend/SorobanSecurityPortalApi.Tests/Controllers/ReportsControllerImageTests.cs Backend/SorobanSecurityPortalApi.Tests/Services/ReportImageServiceTests.cs
git commit -m "Serve report covers as image/webp and cache as .webp"
```

---

## Task 4: Processor methods for backfill

**Files:**
- Modify: `Backend/SorobanSecurityPortalApi/Data/Processors/ReportProcessor.cs`

These have no unit tests in the existing suite (the processor talks directly to EF/Postgres and is covered by manual/integration verification). Add the methods and the interface members; correctness is verified end-to-end in Task 7.

- [ ] **Step 1: Add `GetReportIdsWithBinFile` and `UpdateImage`**

In `ReportProcessor.cs`, add these two methods inside the `ReportProcessor` class (e.g. just after `GetImageBytes`, before `Approve`):

```csharp
        // Backfill helper: ids of reports that still have their source PDF, so their cover can be
        // re-rendered. Selects only the id; the BinFile != null check runs in SQL and never loads bytes.
        public async Task<List<int>> GetReportIdsWithBinFile()
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            return await db.Report
                .AsNoTracking()
                .Where(r => r.BinFile != null)
                .OrderBy(r => r.Id)
                .Select(r => r.Id)
                .ToListAsync();
        }

        // Backfill helper: replaces the stored cover and bumps LastActionAt so the image endpoint's
        // ETag and on-disk cache key (both derived from LastActionAt.Ticks) refresh.
        public async Task UpdateImage(int reportId, byte[] image)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var existing = await db.Report.FirstAsync(item => item.Id == reportId);
            existing.Image = image;
            existing.LastActionAt = DateTime.UtcNow;
            db.Report.Update(existing);
            await db.SaveChangesAsync();
        }
```

- [ ] **Step 2: Add the methods to `IReportProcessor`**

In the `IReportProcessor` interface (same file), add:

```csharp
        Task<List<int>> GetReportIdsWithBinFile();
        Task UpdateImage(int reportId, byte[] image);
```

- [ ] **Step 3: Build to verify it compiles**

Run: `dotnet build Backend/SorobanSecurityPortalApi/SorobanSecurityPortalApi.csproj`
Expected: Build succeeded, 0 errors.

- [ ] **Step 4: Commit**

```bash
git add Backend/SorobanSecurityPortalApi/Data/Processors/ReportProcessor.cs
git commit -m "Add report processor methods for cover backfill"
```

---

## Task 5: Backfill result DTO and `RecompressAllImages` service method

**Files:**
- Create: `Backend/SorobanSecurityPortalApi/Models/ViewModels/RecompressImagesResultViewModel.cs`
- Modify: `Backend/SorobanSecurityPortalApi/Services/ControllersServices/ReportService.cs`

- [ ] **Step 1: Create the result DTO**

Create `Backend/SorobanSecurityPortalApi/Models/ViewModels/RecompressImagesResultViewModel.cs`:

```csharp
namespace SorobanSecurityPortalApi.Models.ViewModels
{
    public class RecompressImagesResultViewModel
    {
        public int Processed { get; set; }
        public int Skipped { get; set; }
        public int Failed { get; set; }
        public long BytesBefore { get; set; }
        public long BytesAfter { get; set; }
    }
}
```

- [ ] **Step 2: Add `RecompressAllImages` to the `IReportService` interface**

In `ReportService.cs`, add to the `IReportService` interface (after `GetStatisticsChanges`):

```csharp
        Task<RecompressImagesResultViewModel> RecompressAllImages();
```

- [ ] **Step 3: Implement `RecompressAllImages`**

In `ReportService.cs`, add this method to the `ReportService` class (e.g. after `GetStatisticsChanges`):

```csharp
        // One-time/idempotent maintenance: re-render every report cover that still has its source
        // PDF into the new compact WebP format. Processes one report at a time to avoid loading all
        // PDFs into memory. Per-report failures are counted, not fatal, so a single bad PDF cannot
        // abort the whole run; re-running is safe.
        public async Task<RecompressImagesResultViewModel> RecompressAllImages()
        {
            var result = new RecompressImagesResultViewModel();
            var ids = await _reportProcessor.GetReportIdsWithBinFile();
            foreach (var id in ids)
            {
                try
                {
                    var report = await _reportProcessor.Get(id);
                    if (report.BinFile == null || report.BinFile.Length == 0)
                    {
                        result.Skipped++;
                        continue;
                    }
                    result.BytesBefore += report.Image?.Length ?? 0;
                    var webp = ReportCoverImage.RenderCoverWebp(report.BinFile);
                    result.BytesAfter += webp.Length;
                    await _reportProcessor.UpdateImage(id, webp);
                    result.Processed++;
                }
                catch
                {
                    result.Failed++;
                }
            }
            return result;
        }
```

(`using SorobanSecurityPortalApi.Common.DataParsers;` was already added in Task 2.)

- [ ] **Step 4: Build to verify it compiles**

Run: `dotnet build Backend/SorobanSecurityPortalApi/SorobanSecurityPortalApi.csproj`
Expected: Build succeeded, 0 errors.

- [ ] **Step 5: Commit**

```bash
git add Backend/SorobanSecurityPortalApi/Models/ViewModels/RecompressImagesResultViewModel.cs Backend/SorobanSecurityPortalApi/Services/ControllersServices/ReportService.cs
git commit -m "Add RecompressAllImages backfill service method"
```

---

## Task 6: Admin endpoint to trigger the backfill

**Files:**
- Modify: `Backend/SorobanSecurityPortalApi/Controllers/ReportsController.cs`
- Test: `Backend/SorobanSecurityPortalApi.Tests/Controllers/ReportsControllerRecompressTests.cs`

- [ ] **Step 1: Write the failing test**

Create `Backend/SorobanSecurityPortalApi.Tests/Controllers/ReportsControllerRecompressTests.cs`:

```csharp
using System.Net.Http;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Controllers;
using SorobanSecurityPortalApi.Models.ViewModels;
using SorobanSecurityPortalApi.Services.AgentServices;
using SorobanSecurityPortalApi.Services.ControllersServices;
using Xunit;

namespace SorobanSecurityPortalApi.Tests.Controllers
{
    public class ReportsControllerRecompressTests
    {
        [Fact]
        public async Task RecompressImages_ReturnsSummaryFromService()
        {
            var summary = new RecompressImagesResultViewModel
            {
                Processed = 50, Skipped = 8, Failed = 0, BytesBefore = 75_000_000, BytesAfter = 3_000_000
            };
            var reportService = new Mock<IReportService>();
            reportService.Setup(s => s.RecompressAllImages()).ReturnsAsync(summary);

            var userContext = new UserContextAccessor(
                Mock.Of<IHttpContextAccessor>(),
                Mock.Of<ILoginProcessor>());
            var controller = new ReportsController(
                reportService.Object,
                Mock.Of<IVulnerabilityExtractionService>(),
                userContext,
                Mock.Of<IHttpClientFactory>(),
                Mock.Of<ILogger<ReportsController>>(),
                Mock.Of<IReportImageService>());

            var result = await controller.RecompressImages();

            var ok = Assert.IsType<OkObjectResult>(result);
            var body = Assert.IsType<RecompressImagesResultViewModel>(ok.Value);
            Assert.Equal(50, body.Processed);
            Assert.Equal(8, body.Skipped);
            reportService.Verify(s => s.RecompressAllImages(), Times.Once);
        }
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `dotnet test Backend/SorobanSecurityPortalApi.Tests/SorobanSecurityPortalApi.Tests.csproj --filter "FullyQualifiedName~ReportsControllerRecompressTests"`
Expected: FAIL — compile error, `controller.RecompressImages()` does not exist.

- [ ] **Step 3: Add the endpoint**

In `ReportsController.cs`, add this action inside the `ReportsController` class (e.g. after `Remove`):

```csharp
        // One-time/idempotent maintenance: re-render all existing report covers into compact WebP.
        // Admin-only; run manually after deploy. See spec 2026-05-29-report-cover-image-compression.
        [RoleAuthorize(Role.Admin)]
        [HttpPost("recompress-images")]
        public async Task<IActionResult> RecompressImages()
        {
            var result = await _reportService.RecompressAllImages();
            _logger.LogInformation(
                "Report cover recompress complete: processed={Processed} skipped={Skipped} failed={Failed} bytesBefore={BytesBefore} bytesAfter={BytesAfter}",
                result.Processed, result.Skipped, result.Failed, result.BytesBefore, result.BytesAfter);
            return Ok(result);
        }
```

(`Role` and `RoleAuthorize` are already imported in this file via the existing `using SorobanSecurityPortalApi.Common.Security;` and `using SorobanSecurityPortalApi.Authorization.Attributes;`.)

- [ ] **Step 4: Run test to verify it passes**

Run: `dotnet test Backend/SorobanSecurityPortalApi.Tests/SorobanSecurityPortalApi.Tests.csproj --filter "FullyQualifiedName~ReportsControllerRecompressTests"`
Expected: PASS.

- [ ] **Step 5: Run the full test suite**

Run: `dotnet test Backend/SorobanSecurityPortalApi.Tests/SorobanSecurityPortalApi.Tests.csproj`
Expected: PASS — all tests green (existing + new).

- [ ] **Step 6: Commit**

```bash
git add Backend/SorobanSecurityPortalApi/Controllers/ReportsController.cs Backend/SorobanSecurityPortalApi.Tests/Controllers/ReportsControllerRecompressTests.cs
git commit -m "Add admin endpoint to recompress existing report covers"
```

---

## Task 7: Manual verification & backfill run (deploy step)

No code changes — this verifies the end-to-end behavior and runs the one-time backfill.
Use the project's deployment flow (see memory: dev images `andreykerchin/*`, helm chart at `Deploy/helm`).

- [ ] **Step 1: Verify a new upload produces a small WebP (dev)**

Deploy the branch to dev, then upload a report PDF via the UI (Add Report). Then fetch its cover and confirm format + size, e.g. in PowerShell:

```powershell
Invoke-WebRequest -Uri "https://<dev-host>/api/v1/reports/<newId>/image.png" -OutFile "$env:TEMP\cover.webp"
$h = (Invoke-WebRequest -Uri "https://<dev-host>/api/v1/reports/<newId>/image.png").Headers["Content-Type"]
"Content-Type: $h; Size KB: " + [math]::Round((Get-Item "$env:TEMP\cover.webp").Length/1KB)
```
Expected: `Content-Type: image/webp`; size in the tens of KB (not MB).

- [ ] **Step 2: Run the backfill on dev**

As an Admin user, POST to the backfill endpoint (the browser session/JWT must carry the Admin role):

```powershell
# Using an admin bearer token obtained from the dev session
Invoke-RestMethod -Method Post -Uri "https://<dev-host>/api/v1/reports/recompress-images" -Headers @{ Authorization = "Bearer <admin-jwt>" }
```
Expected: JSON summary, e.g. `{ "processed": 50, "skipped": 8, "failed": 0, "bytesBefore": ~75000000, "bytesAfter": ~3000000 }`. `failed` should be 0.

- [ ] **Step 3: Re-measure existing covers (dev)**

Re-run the production-style measurement (a few report ids) and confirm covers are now WebP and ~20-40× smaller, and the Reports grid + admin list + report detail still render correctly. Confirm `failed == 0`; if not, inspect logs for the offending report ids.

- [ ] **Step 4: Production note**

After dev is verified and the branch is merged/deployed to prod, run the same `recompress-images` POST once against prod as Admin. It is idempotent — safe to re-run if interrupted.

---

## Notes for the implementer

- **SkiaSharp version:** the API uses SkiaSharp 3.x (transitive via PDFtoImage 5.2.1). `SKBitmap.Resize(SKImageInfo, SKSamplingOptions)` and `SKImage.Encode(SKEncodedImageFormat.Webp, quality)` are the correct 3.x calls. Do **not** use the removed `SKFilterQuality` overload.
- **Route name stays `image.png`:** content type, not file extension, governs how browsers/crawlers decode the bytes. Renaming the route would force edits across `reports.tsx`, `list-reports.tsx`, `EntityAvatar.tsx`, and `OgController` — out of scope.
- **Cache busting depends on `LastActionAt`:** that is why `UpdateImage` bumps it. Do not drop that line.
- **Test styles:** the Tests project has global usings for `Xunit`, `FluentAssertions`, `Moq`. Match each file's existing assertion style (FluentAssertions `.Should()` in service/helper tests, xUnit `Assert` in the existing controller tests).

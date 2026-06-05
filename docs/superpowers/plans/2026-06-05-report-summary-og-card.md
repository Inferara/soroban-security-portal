# Report Summary OG Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the PDF-cover image in the social/link-preview card for `/report/{id}` with a generated PNG stats card (report name + auditor + Total / Fixed / Not Fixed / Fixed Rate + branding).

**Architecture:** A slim DB projection feeds a stats service; a pure SkiaSharp renderer turns the stats into a 1200×630 PNG; a cache service mirrors the existing `ReportImageService` (on-disk, ETag/signature-keyed); a new `OgController` endpoint serves the PNG with `If-None-Match`/304; `OgController.Report` points `og:image` at it.

**Tech Stack:** ASP.NET Core (.NET 10), EF Core (Npgsql), SkiaSharp 3.119.2 (already transitive via `PDFtoImage`), xUnit + Moq + FluentAssertions.

**Spec:** `docs/superpowers/specs/2026-06-05-report-summary-og-card-design.md`

---

## File Structure

- Create `Backend/SorobanSecurityPortalApi/Models/ViewModels/ReportSummaryStats.cs` — stats DTO + slim meta record.
- Modify `Backend/SorobanSecurityPortalApi/Data/Processors/ReportProcessor.cs` — add `GetSummaryMeta` slim projection (+ interface entry).
- Modify `Backend/SorobanSecurityPortalApi/Services/ControllersServices/ReportService.cs` — expose `GetSummaryMeta` (+ interface entry).
- Create `Backend/SorobanSecurityPortalApi/Services/ControllersServices/ReportSummaryService.cs` — `IReportSummaryService.GetStats`.
- Create `Backend/SorobanSecurityPortalApi/Services/Rendering/ReportSummaryCardRenderer.cs` — `IReportSummaryCardRenderer`, SkiaSharp PNG.
- Create `Backend/SorobanSecurityPortalApi/Services/ControllersServices/ReportSummaryCardService.cs` — `IReportSummaryCardService`, disk cache.
- Modify `Backend/SorobanSecurityPortalApi/Controllers/OgController.cs` — new `summary.png` endpoint + `og:image` change.
- Modify `Backend/SorobanSecurityPortalApi/SorobanSecurityPortalApi.csproj` — SkiaSharp refs + embedded font.
- Create `Backend/SorobanSecurityPortalApi/Resources/Fonts/DejaVuSans.ttf` + `DejaVuSans-Bold.ttf` — bundled fonts.
- Modify `Backend/SorobanSecurityPortalApi.Tests/Controllers/OgControllerTests.cs` — update + add tests.
- Create `Backend/SorobanSecurityPortalApi.Tests/Services/ReportSummaryServiceTests.cs`.
- Create `Backend/SorobanSecurityPortalApi.Tests/Services/ReportSummaryCardRendererTests.cs`.

All `dotnet` commands run from `Backend/`. The test project is `SorobanSecurityPortalApi.Tests`.

---

## Task 1: SkiaSharp packages + bundled font

**Files:**
- Modify: `Backend/SorobanSecurityPortalApi/SorobanSecurityPortalApi.csproj`
- Create: `Backend/SorobanSecurityPortalApi/Resources/Fonts/DejaVuSans.ttf`
- Create: `Backend/SorobanSecurityPortalApi/Resources/Fonts/DejaVuSans-Bold.ttf`

DejaVu Sans is used because the runtime image bundles `SkiaSharp.NativeAssets.Linux.NoDependencies` (no fontconfig, no system fonts), and DejaVu's license permits redistribution. Windows system fonts (Arial/Segoe) are NOT redistributable — do not bundle them.

- [ ] **Step 1: Obtain the two TTF files**

Download from the official DejaVu release and place them at the paths above:

```bash
cd Backend/SorobanSecurityPortalApi
mkdir -p Resources/Fonts
curl -L -o Resources/Fonts/DejaVuSans.ttf \
  https://raw.githubusercontent.com/dejavu-fonts/dejavu-fonts/version_2_37/ttf/DejaVuSans.ttf
curl -L -o Resources/Fonts/DejaVuSans-Bold.ttf \
  https://raw.githubusercontent.com/dejavu-fonts/dejavu-fonts/version_2_37/ttf/DejaVuSans-Bold.ttf
```

Verify they are real TrueType files (must print `TrueType` / non-trivial size, ~700KB and ~650KB):

```bash
file Resources/Fonts/DejaVuSans.ttf Resources/Fonts/DejaVuSans-Bold.ttf
ls -l Resources/Fonts/
```

Expected: both report `TrueType Font data` (or similar) and are several hundred KB. If `curl` is blocked, copy the files from any Linux box at `/usr/share/fonts/truetype/dejavu/`.

- [ ] **Step 2: Add package references and embed the fonts**

In `SorobanSecurityPortalApi.csproj`, add to the existing `<ItemGroup>` that holds `<PackageReference>`s:

```xml
<PackageReference Include="SkiaSharp" Version="3.119.2" />
<PackageReference Include="SkiaSharp.NativeAssets.Linux.NoDependencies" Version="3.119.2" />
```

Add a new `<ItemGroup>` to embed the fonts:

```xml
<ItemGroup>
  <EmbeddedResource Include="Resources\Fonts\DejaVuSans.ttf" />
  <EmbeddedResource Include="Resources\Fonts\DejaVuSans-Bold.ttf" />
</ItemGroup>
```

- [ ] **Step 3: Verify it restores and builds**

Run: `dotnet build SorobanSecurityPortalApi/SorobanSecurityPortalApi.csproj -c Debug`
Expected: build succeeds; SkiaSharp 3.119.2 restored with no version-conflict warning (it matches what `PDFtoImage` already resolves).

- [ ] **Step 4: Commit**

```bash
git add Backend/SorobanSecurityPortalApi/SorobanSecurityPortalApi.csproj Backend/SorobanSecurityPortalApi/Resources/Fonts
git commit -m "build: add SkiaSharp refs and bundle DejaVu fonts for OG card rendering"
```

---

## Task 2: Stats DTO, slim projection, and stats service

**Files:**
- Create: `Backend/SorobanSecurityPortalApi/Models/ViewModels/ReportSummaryStats.cs`
- Modify: `Backend/SorobanSecurityPortalApi/Data/Processors/ReportProcessor.cs` (add method + interface entry near line 167-205 / interface ~line 364)
- Modify: `Backend/SorobanSecurityPortalApi/Services/ControllersServices/ReportService.cs` (add method + interface entry ~line 205/213)
- Create: `Backend/SorobanSecurityPortalApi/Services/ControllersServices/ReportSummaryService.cs`
- Test: `Backend/SorobanSecurityPortalApi.Tests/Services/ReportSummaryServiceTests.cs`

Stat semantics mirror `UI/.../report-details/report-details.tsx` exactly:
`Total` = all vulns; `Fixed` = category `Valid` (0); `NotFixed` = `Total - Fixed`;
`FixedRate` = `round(Fixed / Total * 100)`, `0` when `Total == 0`.

- [ ] **Step 1: Create the DTOs**

Create `Models/ViewModels/ReportSummaryStats.cs`:

```csharp
namespace SorobanSecurityPortalApi.Models.ViewModels
{
    // Slim report metadata for the OG summary card; never carries the heavy
    // Image/BinFile/MdFile/embedding columns.
    public record ReportSummaryMeta(string Name, string? AuditorName, string Status, DateTime LastActionAt);

    // Everything the summary card renders, plus a Signature used as the cache/ETag key.
    public record ReportSummaryStats(
        string ReportName,
        string? AuditorName,
        int Total,
        int Fixed,
        int NotFixed,
        int FixedRate,
        string Signature);
}
```

- [ ] **Step 2: Add the slim projection on the processor**

In `Data/Processors/ReportProcessor.cs`, add after `GetImageBytes` (after line ~205):

```csharp
// Slim query for the OG summary card: name + auditor name + status + last-modified only.
// Never de-TOASTs Image/BinFile/MdFile/embedding. Applies the public moderation filter.
public async Task<ReportSummaryMeta?> GetSummaryMeta(int reportId)
{
    await using var db = await _dbFactory.CreateDbContextAsync();
    return await db.Report
        .AsNoTracking()
        .Where(r => r.Id == reportId && !r.IsHidden && !r.IsDeleted)
        .Select(r => new ReportSummaryMeta(r.Name, r.Auditor != null ? r.Auditor.Name : null, r.Status, r.LastActionAt))
        .FirstOrDefaultAsync();
}
```

Add to the `IReportProcessor` interface (near `Task<DateTime?> GetImageLastModified(int reportId);`):

```csharp
Task<ReportSummaryMeta?> GetSummaryMeta(int reportId);
```

Ensure `ReportProcessor.cs` has `using SorobanSecurityPortalApi.Models.ViewModels;` (add if missing).

- [ ] **Step 3: Expose it on the report service**

In `Services/ControllersServices/ReportService.cs`, add after `GetPublic` (~line 65):

```csharp
public Task<ReportSummaryMeta?> GetSummaryMeta(int reportId) =>
    _reportProcessor.GetSummaryMeta(reportId);
```

Add to the `IReportService` interface (after `Task<ReportViewModel?> GetPublic(int reportId);`):

```csharp
Task<ReportSummaryMeta?> GetSummaryMeta(int reportId);
```

- [ ] **Step 4: Write the failing stats-service test**

Create `Backend/SorobanSecurityPortalApi.Tests/Services/ReportSummaryServiceTests.cs`:

```csharp
using System.Collections.Generic;
using System.Threading.Tasks;
using FluentAssertions;
using Moq;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;
using SorobanSecurityPortalApi.Services.ControllersServices;
using Xunit;

namespace SorobanSecurityPortalApi.Tests.Services
{
    public class ReportSummaryServiceTests
    {
        private readonly Mock<IReportService> _report = new();
        private readonly Mock<IVulnerabilityService> _vuln = new();

        private ReportSummaryService Sut() => new(_report.Object, _vuln.Object);

        private static VulnerabilityViewModel V(VulnerabilityCategory c) =>
            new() { Category = c, Severity = "high" };

        [Fact]
        public async Task GetStats_ComputesFixedNotFixedAndRate_MirroringUi()
        {
            _report.Setup(s => s.GetSummaryMeta(3)).ReturnsAsync(
                new ReportSummaryMeta("Acme Audit", "Runtime Verification", ReportModelStatus.Approved, new System.DateTime(2026, 1, 1)));
            var vulns = new List<VulnerabilityViewModel>();
            for (int i = 0; i < 42; i++) vulns.Add(V(VulnerabilityCategory.Valid));
            for (int i = 0; i < 4; i++) vulns.Add(V(VulnerabilityCategory.ValidNotFixed));
            for (int i = 0; i < 2; i++) vulns.Add(V(VulnerabilityCategory.Invalid));
            _vuln.Setup(s => s.Search(It.IsAny<VulnerabilitySearchViewModel>())).ReturnsAsync(vulns);

            var stats = await Sut().GetStats(3);

            stats.Should().NotBeNull();
            stats!.Total.Should().Be(48);
            stats.Fixed.Should().Be(42);
            stats.NotFixed.Should().Be(6);
            stats.FixedRate.Should().Be(88); // round(42/48*100)
            stats.ReportName.Should().Be("Acme Audit");
            stats.AuditorName.Should().Be("Runtime Verification");
            stats.Signature.Should().NotBeNullOrEmpty();
        }

        [Fact]
        public async Task GetStats_ZeroVulns_RateIsZero()
        {
            _report.Setup(s => s.GetSummaryMeta(3)).ReturnsAsync(
                new ReportSummaryMeta("Empty", null, ReportModelStatus.Approved, new System.DateTime(2026, 1, 1)));
            _vuln.Setup(s => s.Search(It.IsAny<VulnerabilitySearchViewModel>())).ReturnsAsync(new List<VulnerabilityViewModel>());

            var stats = await Sut().GetStats(3);

            stats.Should().NotBeNull();
            stats!.Total.Should().Be(0);
            stats.Fixed.Should().Be(0);
            stats.NotFixed.Should().Be(0);
            stats.FixedRate.Should().Be(0);
        }

        [Fact]
        public async Task GetStats_MissingReport_ReturnsNull()
        {
            _report.Setup(s => s.GetSummaryMeta(It.IsAny<int>())).ReturnsAsync((ReportSummaryMeta?)null);
            (await Sut().GetStats(99)).Should().BeNull();
        }

        [Fact]
        public async Task GetStats_NotApproved_ReturnsNull()
        {
            _report.Setup(s => s.GetSummaryMeta(3)).ReturnsAsync(
                new ReportSummaryMeta("Draft", null, ReportModelStatus.New, new System.DateTime(2026, 1, 1)));
            (await Sut().GetStats(3)).Should().BeNull();
        }

        [Fact]
        public async Task GetStats_SignatureChangesWhenCountsChange()
        {
            _report.Setup(s => s.GetSummaryMeta(3)).ReturnsAsync(
                new ReportSummaryMeta("Acme", null, ReportModelStatus.Approved, new System.DateTime(2026, 1, 1)));
            _vuln.Setup(s => s.Search(It.IsAny<VulnerabilitySearchViewModel>()))
                 .ReturnsAsync(new List<VulnerabilityViewModel> { V(VulnerabilityCategory.Valid) });
            var s1 = (await Sut().GetStats(3))!.Signature;

            _vuln.Setup(s => s.Search(It.IsAny<VulnerabilitySearchViewModel>()))
                 .ReturnsAsync(new List<VulnerabilityViewModel> { V(VulnerabilityCategory.Valid), V(VulnerabilityCategory.Valid) });
            var s2 = (await Sut().GetStats(3))!.Signature;

            s1.Should().NotBe(s2);
        }
    }
}
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `dotnet test SorobanSecurityPortalApi.Tests --filter ReportSummaryServiceTests`
Expected: FAIL — `ReportSummaryService` does not exist / does not compile.

- [ ] **Step 6: Implement the stats service**

Create `Services/ControllersServices/ReportSummaryService.cs`:

```csharp
using System.Security.Cryptography;
using System.Text;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;

namespace SorobanSecurityPortalApi.Services.ControllersServices
{
    // Computes the vulnerability stats shown on the OG summary card. Mirrors the on-page
    // report card (report-details.tsx): Fixed = category Valid, NotFixed = everything else.
    public class ReportSummaryService : IReportSummaryService
    {
        private readonly IReportService _reportService;
        private readonly IVulnerabilityService _vulnerabilityService;

        public ReportSummaryService(IReportService reportService, IVulnerabilityService vulnerabilityService)
        {
            _reportService = reportService;
            _vulnerabilityService = vulnerabilityService;
        }

        public async Task<ReportSummaryStats?> GetStats(int reportId)
        {
            var meta = await _reportService.GetSummaryMeta(reportId);
            if (meta == null || meta.Status != ReportModelStatus.Approved)
                return null;

            // Same query the report page uses (hidden/soft-deleted already excluded). PageSize -1
            // returns all rows; descriptions are skipped (not needed for counts).
            var vulns = await _vulnerabilityService.Search(new VulnerabilitySearchViewModel
            {
                Reports = new List<string> { meta.Name },
                PageSize = -1,
                IncludeDescription = false
            });

            var total = vulns.Count;
            var fixedCount = vulns.Count(v => v.Category == VulnerabilityCategory.Valid);
            var notFixed = total - fixedCount;
            var rate = total > 0 ? (int)Math.Round((double)fixedCount / total * 100) : 0;

            var signature = BuildSignature(reportId, meta, total, fixedCount, notFixed);
            return new ReportSummaryStats(meta.Name, meta.AuditorName, total, fixedCount, notFixed, rate, signature);
        }

        // Short, stable hash of everything the rendered card depends on -> used as cache/ETag key.
        private static string BuildSignature(int reportId, ReportSummaryMeta meta, int total, int fixedCount, int notFixed)
        {
            var raw = $"{reportId}|{meta.LastActionAt.Ticks}|{total}|{fixedCount}|{notFixed}|{meta.AuditorName}|{meta.Name}";
            var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(raw));
            return Convert.ToHexString(bytes, 0, 8).ToLowerInvariant(); // 16 hex chars
        }
    }

    public interface IReportSummaryService
    {
        Task<ReportSummaryStats?> GetStats(int reportId);
    }
}
```

`IReportSummaryService` is auto-registered as transient by the `^I(?!.*Processor$).*` convention scan in `Startup.cs` — no manual DI needed.

- [ ] **Step 7: Run the test to verify it passes**

Run: `dotnet test SorobanSecurityPortalApi.Tests --filter ReportSummaryServiceTests`
Expected: PASS (5 tests).

- [ ] **Step 8: Commit**

```bash
git add Backend/SorobanSecurityPortalApi/Models/ViewModels/ReportSummaryStats.cs \
        Backend/SorobanSecurityPortalApi/Data/Processors/ReportProcessor.cs \
        Backend/SorobanSecurityPortalApi/Services/ControllersServices/ReportService.cs \
        Backend/SorobanSecurityPortalApi/Services/ControllersServices/ReportSummaryService.cs \
        Backend/SorobanSecurityPortalApi.Tests/Services/ReportSummaryServiceTests.cs
git commit -m "feat(og): compute report summary stats for the link-preview card"
```

---

## Task 3: SkiaSharp card renderer

**Files:**
- Create: `Backend/SorobanSecurityPortalApi/Services/Rendering/ReportSummaryCardRenderer.cs`
- Test: `Backend/SorobanSecurityPortalApi.Tests/Services/ReportSummaryCardRendererTests.cs`

- [ ] **Step 1: Write the failing renderer test**

Create `Backend/SorobanSecurityPortalApi.Tests/Services/ReportSummaryCardRendererTests.cs`:

```csharp
using FluentAssertions;
using SkiaSharp;
using SorobanSecurityPortalApi.Models.ViewModels;
using SorobanSecurityPortalApi.Services.Rendering;
using Xunit;

namespace SorobanSecurityPortalApi.Tests.Services
{
    public class ReportSummaryCardRendererTests
    {
        private static ReportSummaryStats Stats(string name = "Acme Audit", string? auditor = "Runtime Verification",
            int total = 48, int fixedC = 42, int notFixed = 6, int rate = 88) =>
            new(name, auditor, total, fixedC, notFixed, rate, "sig123");

        [Fact]
        public void Render_ProducesValidPng_1200x630()
        {
            var bytes = new ReportSummaryCardRenderer().Render(Stats());

            bytes.Should().NotBeNullOrEmpty();
            using var bmp = SKBitmap.Decode(bytes);
            bmp.Should().NotBeNull();
            bmp.Width.Should().Be(1200);
            bmp.Height.Should().Be(630);
        }

        [Fact]
        public void Render_IsDeterministic_ForSameStats()
        {
            var r = new ReportSummaryCardRenderer();
            r.Render(Stats()).Should().Equal(r.Render(Stats()));
        }

        [Fact]
        public void Render_HandlesNoAuditor_AndLongName_AndZeroVulns()
        {
            var r = new ReportSummaryCardRenderer();
            var longName = new string('X', 200);
            var act = () => r.Render(Stats(name: longName, auditor: null, total: 0, fixedC: 0, notFixed: 0, rate: 0));
            act.Should().NotThrow();
            r.Render(Stats(auditor: null)).Should().NotBeNullOrEmpty();
        }
    }
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `dotnet test SorobanSecurityPortalApi.Tests --filter ReportSummaryCardRendererTests`
Expected: FAIL — `ReportSummaryCardRenderer` does not exist.

- [ ] **Step 3: Implement the renderer**

Create `Services/Rendering/ReportSummaryCardRenderer.cs`:

```csharp
using System.Reflection;
using SkiaSharp;
using SorobanSecurityPortalApi.Models.ViewModels;

namespace SorobanSecurityPortalApi.Services.Rendering
{
    // Renders a 1200x630 PNG summary card for the report link-preview (og:image).
    // Self-contained: bundles its own fonts so it works in the fontconfig-less Linux image.
    public class ReportSummaryCardRenderer : IReportSummaryCardRenderer
    {
        private const int Width = 1200;
        private const int Height = 630;

        // Brand palette (dark card matching the in-app stats card screenshot).
        private static readonly SKColor Background = new(0x12, 0x16, 0x21);
        private static readonly SKColor CardBorder = new(0x2A, 0x31, 0x42);
        private static readonly SKColor TextPrimary = new(0xF5, 0xF7, 0xFA);
        private static readonly SKColor TextMuted = new(0x9A, 0xA4, 0xB2);
        private static readonly SKColor Total = new(0xE5, 0xA8, 0x3A);  // amber
        private static readonly SKColor Fixed = new(0x3F, 0xC1, 0x6A);  // green
        private static readonly SKColor NotFixed = new(0xE5, 0x4B, 0x4B); // red
        private static readonly SKColor Rate = new(0x4F, 0x9C, 0xF0);   // blue

        // Fonts are embedded resources; load once.
        private static readonly SKTypeface Regular = LoadFont("DejaVuSans.ttf");
        private static readonly SKTypeface Bold = LoadFont("DejaVuSans-Bold.ttf");

        public byte[] Render(ReportSummaryStats s)
        {
            var info = new SKImageInfo(Width, Height);
            using var surface = SKSurface.Create(info);
            var canvas = surface.Canvas;
            canvas.Clear(Background);

            // Outer rounded border for a card look.
            using (var border = new SKPaint { Color = CardBorder, IsStroke = true, StrokeWidth = 2, IsAntialias = true })
                canvas.DrawRoundRect(new SKRect(24, 24, Width - 24, Height - 24), 24, 24, border);

            // Brand header.
            DrawText(canvas, "STELLAR SECURITY PORTAL", 72, 110, Bold, 34, TextMuted);

            // Report name (up to 2 wrapped lines, ellipsised).
            var nameLines = WrapText(s.ReportName, Bold, 60, Width - 144, maxLines: 2);
            var y = 220;
            foreach (var line in nameLines) { DrawText(canvas, line, 72, y, Bold, 60, TextPrimary); y += 72; }

            // Auditor line (optional).
            if (!string.IsNullOrWhiteSpace(s.AuditorName))
                DrawText(canvas, $"Security audit by {s.AuditorName}", 72, y + 12, Regular, 32, TextMuted);

            // Four stat columns.
            DrawStat(canvas, 0, s.Total.ToString(), "Total", Total);
            DrawStat(canvas, 1, s.Fixed.ToString(), "Fixed", Fixed);
            DrawStat(canvas, 2, s.NotFixed.ToString(), "Not Fixed", NotFixed);
            DrawStat(canvas, 3, s.Total > 0 ? $"{s.FixedRate}%" : "—", "Fixed Rate", Rate);

            using var image = surface.Snapshot();
            using var data = image.Encode(SKEncodedImageFormat.Png, 100);
            return data.ToArray();
        }

        private static void DrawStat(SKCanvas canvas, int col, string value, string label, SKColor valueColor)
        {
            const int baseX = 72;
            const int colWidth = (Width - 144) / 4;
            var cx = baseX + col * colWidth + colWidth / 2;
            DrawTextCentered(canvas, value, cx, 500, Bold, 72, valueColor);
            DrawTextCentered(canvas, label, cx, 555, Regular, 30, TextMuted);
        }

        private static void DrawText(SKCanvas canvas, string text, float x, float y, SKTypeface tf, float size, SKColor color)
        {
            using var font = new SKFont(tf, size);
            using var paint = new SKPaint { Color = color, IsAntialias = true };
            canvas.DrawText(text, x, y, SKTextAlign.Left, font, paint);
        }

        private static void DrawTextCentered(SKCanvas canvas, string text, float cx, float y, SKTypeface tf, float size, SKColor color)
        {
            using var font = new SKFont(tf, size);
            using var paint = new SKPaint { Color = color, IsAntialias = true };
            canvas.DrawText(text, cx, y, SKTextAlign.Center, font, paint);
        }

        // Greedy word-wrap to a pixel width; last allowed line gets an ellipsis if text remains.
        private static List<string> WrapText(string text, SKTypeface tf, float size, float maxWidth, int maxLines)
        {
            using var font = new SKFont(tf, size);
            var words = (text ?? string.Empty).Split(' ', StringSplitOptions.RemoveEmptyEntries);
            var lines = new List<string>();
            var current = "";
            foreach (var word in words)
            {
                var candidate = current.Length == 0 ? word : current + " " + word;
                if (font.MeasureText(candidate) <= maxWidth) { current = candidate; continue; }
                if (current.Length > 0) lines.Add(current);
                current = word;
                if (lines.Count == maxLines) break;
            }
            if (current.Length > 0 && lines.Count < maxLines) lines.Add(current);
            if (lines.Count == 0) lines.Add("");

            // Hard-truncate the final line (handles a single over-long word and overflow).
            var last = lines[^1];
            while (font.MeasureText(last + "…") > maxWidth && last.Length > 1)
                last = last[..^1];
            if (last != lines[^1]) lines[^1] = last + "…";
            return lines;
        }

        private static SKTypeface LoadFont(string fileName)
        {
            var asm = typeof(ReportSummaryCardRenderer).Assembly;
            var resource = $"SorobanSecurityPortalApi.Resources.Fonts.{fileName}";
            using var stream = asm.GetManifestResourceStream(resource)
                ?? throw new InvalidOperationException($"Embedded font not found: {resource}");
            return SKTypeface.FromStream(stream) ?? SKTypeface.Default;
        }
    }

    public interface IReportSummaryCardRenderer
    {
        byte[] Render(ReportSummaryStats stats);
    }
}
```

Note: the embedded-resource name is `<DefaultNamespace>.<folder-with-dots>.<file>`. The project's default namespace is `SorobanSecurityPortalApi`, so the resource id is `SorobanSecurityPortalApi.Resources.Fonts.DejaVuSans.ttf`. If `GetManifestResourceStream` returns null at runtime, list the real names once via `asm.GetManifestResourceNames()` and adjust.

- [ ] **Step 4: Run the test to verify it passes**

Run: `dotnet test SorobanSecurityPortalApi.Tests --filter ReportSummaryCardRendererTests`
Expected: PASS (3 tests). If a test throws `Embedded font not found`, the resource id differs — fix per the note above and re-run.

- [ ] **Step 5: Commit**

```bash
git add Backend/SorobanSecurityPortalApi/Services/Rendering/ReportSummaryCardRenderer.cs \
        Backend/SorobanSecurityPortalApi.Tests/Services/ReportSummaryCardRendererTests.cs
git commit -m "feat(og): render report summary card PNG with SkiaSharp"
```

---

## Task 4: Disk-cached card service

**Files:**
- Create: `Backend/SorobanSecurityPortalApi/Services/ControllersServices/ReportSummaryCardService.cs`

This mirrors `ReportImageService` (atomic write, rebuildable on-disk copy) but keys the cache
file by the stats `Signature` (so the file changes whenever the rendered card would change) and
reuses `IExtendedConfig.ReportImageCacheDir`.

- [ ] **Step 1: Implement the card service**

Create `Services/ControllersServices/ReportSummaryCardService.cs`:

```csharp
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Services.Rendering;

namespace SorobanSecurityPortalApi.Services.ControllersServices
{
    public record ReportSummaryCardContent(byte[] Bytes, string ETag, DateTimeOffset LastModified);

    // Serves the report summary card PNG as a cached, rebuildable on-disk file keyed by the
    // stats signature. Returns null when the report is missing/unapproved.
    public class ReportSummaryCardService : IReportSummaryCardService
    {
        private readonly IReportSummaryService _summaryService;
        private readonly IReportSummaryCardRenderer _renderer;
        private readonly IExtendedConfig _config;

        public ReportSummaryCardService(
            IReportSummaryService summaryService,
            IReportSummaryCardRenderer renderer,
            IExtendedConfig config)
        {
            _summaryService = summaryService;
            _renderer = renderer;
            _config = config;
        }

        public async Task<ReportSummaryCardContent?> GetCardAsync(int reportId)
        {
            var stats = await _summaryService.GetStats(reportId);
            if (stats == null)
                return null;

            var etag = $"\"rsc{reportId}-{stats.Signature}\"";
            var lastModified = DateTimeOffset.UtcNow; // stable per-signature via the ETag; date is informational
            var path = CacheFilePath(reportId, stats.Signature);

            byte[]? bytes = null;
            if (File.Exists(path))
            {
                try { bytes = await File.ReadAllBytesAsync(path); }
                catch (IOException) { bytes = null; }
            }

            if (bytes == null || bytes.Length == 0)
            {
                bytes = _renderer.Render(stats);
                WriteAtomic(path, bytes);
            }

            return new ReportSummaryCardContent(bytes, etag, lastModified);
        }

        public async Task<string?> GetETagAsync(int reportId)
        {
            var stats = await _summaryService.GetStats(reportId);
            return stats == null ? null : $"\"rsc{reportId}-{stats.Signature}\"";
        }

        private string CacheFilePath(int reportId, string signature)
        {
            var dir = _config.ReportImageCacheDir;
            Directory.CreateDirectory(dir);
            // Filename is the integer id + hex signature only -> no path traversal.
            return Path.Combine(dir, $"report-summary-{reportId}-{signature}.png");
        }

        private static void WriteAtomic(string path, byte[] bytes)
        {
            var tmp = $"{path}.{Guid.NewGuid():N}.tmp";
            try
            {
                File.WriteAllBytes(tmp, bytes);
                File.Move(tmp, path, overwrite: true);
            }
            catch (IOException)
            {
                // Another request materialized the same file concurrently; that copy is fine.
            }
            finally
            {
                if (File.Exists(tmp))
                {
                    try { File.Delete(tmp); } catch (IOException) { }
                }
            }
        }
    }

    public interface IReportSummaryCardService
    {
        Task<ReportSummaryCardContent?> GetCardAsync(int reportId);
        Task<string?> GetETagAsync(int reportId);
    }
}
```

- [ ] **Step 2: Verify it builds**

Run: `dotnet build SorobanSecurityPortalApi/SorobanSecurityPortalApi.csproj -c Debug`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add Backend/SorobanSecurityPortalApi/Services/ControllersServices/ReportSummaryCardService.cs
git commit -m "feat(og): disk-cached report summary card service"
```

---

## Task 5: OgController endpoint + og:image switch

**Files:**
- Modify: `Backend/SorobanSecurityPortalApi/Controllers/OgController.cs`
- Modify: `Backend/SorobanSecurityPortalApi.Tests/Controllers/OgControllerTests.cs`

- [ ] **Step 1: Update the existing tests and add new ones**

In `OgControllerTests.cs`:

Add a mock field next to the others (line ~18):

```csharp
private readonly Mock<IReportSummaryCardService> _cards = new();
```

Update `Sut()` (line ~38) to pass it:

```csharp
var ctrl = new OgController(_vuln.Object, _report.Object, _config, _pageViews.Object, _cards.Object);
```

Replace the `Report_Approved_WithImage_UsesImageEndpoint` test (lines 86-94) with:

```csharp
[Fact]
public async Task Report_Approved_UsesSummaryCardImage()
{
    _report.Setup(s => s.Get(3)).ReturnsAsync(new ReportViewModel
    { Id = 3, Name = "Acme Audit", Status = "approved", Image = new byte[] { 1, 2, 3 } });
    var body = Body(await Sut().Report(3));
    body.Should().Contain("<meta property=\"og:title\" content=\"Acme Audit\">");
    body.Should().Contain("og:image\" content=\"https://sorobanshield.ru/api/v1/og/report/3/summary.png\"");
    body.Should().NotContain("/reports/3/image.png");
}
```

Add two endpoint tests at the end of the class:

```csharp
[Fact]
public async Task SummaryImage_Missing_Returns404()
{
    _cards.Setup(c => c.GetETagAsync(99)).ReturnsAsync((string?)null);
    var result = await Sut().ReportSummaryImage(99);
    result.Should().BeOfType<NotFoundResult>();
}

[Fact]
public async Task SummaryImage_MatchingIfNoneMatch_Returns304()
{
    _cards.Setup(c => c.GetETagAsync(3)).ReturnsAsync("\"rsc3-abc\"");
    var ctrl = Sut();
    ctrl.ControllerContext.HttpContext.Request.Headers.IfNoneMatch = "\"rsc3-abc\"";
    var result = await ctrl.ReportSummaryImage(3);
    (result as StatusCodeResult)!.StatusCode.Should().Be(304);
}

[Fact]
public async Task SummaryImage_ReturnsPngFile()
{
    _cards.Setup(c => c.GetETagAsync(3)).ReturnsAsync("\"rsc3-abc\"");
    _cards.Setup(c => c.GetCardAsync(3)).ReturnsAsync(
        new ReportSummaryCardContent(new byte[] { 1, 2, 3 }, "\"rsc3-abc\"", System.DateTimeOffset.UtcNow));
    var result = await Sut().ReportSummaryImage(3);
    var file = result as FileContentResult;
    file.Should().NotBeNull();
    file!.ContentType.Should().Be("image/png");
}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `dotnet test SorobanSecurityPortalApi.Tests --filter OgControllerTests`
Expected: FAIL — `OgController` has no 5-arg constructor and no `ReportSummaryImage`.

- [ ] **Step 3: Update OgController**

In `Controllers/OgController.cs`:

Add the dependency. Replace the field block + constructor (lines 22-33) with:

```csharp
private readonly IVulnerabilityService _vulnerabilityService;
private readonly IReportService _reportService;
private readonly Config _config;
private readonly IPageViewService _pageViewService;
private readonly IReportSummaryCardService _summaryCardService;

public OgController(
    IVulnerabilityService vulnerabilityService,
    IReportService reportService,
    Config config,
    IPageViewService pageViewService,
    IReportSummaryCardService summaryCardService)
{
    _vulnerabilityService = vulnerabilityService;
    _reportService = reportService;
    _config = config;
    _pageViewService = pageViewService;
    _summaryCardService = summaryCardService;
}
```

Replace the image-selection lines in `Report` (lines 62-66) with:

```csharp
// Always use the generated summary card (vuln stats), never the PDF cover, per the
// link-preview design. The card endpoint 404s for unapproved/missing reports, but this
// branch is only reached for approved ones.
var image = $"{_config.AppUrl}/og/report/{id}/summary.png";
await RecordCrawlerView(EntityType.Report, id);
return Page(r.Name, $"Security audit report: {r.Name}", image, pageUrl);
```

Add the new endpoint after the `Report` action (after line ~67), mirroring `ReportsController.GetImage`:

```csharp
// Serves the generated 1200x630 summary-card PNG used as og:image for /report/{id}.
[HttpGet("report/{id:int}/summary.png")]
public async Task<IActionResult> ReportSummaryImage(int id)
{
    var etag = await _summaryCardService.GetETagAsync(id);
    if (etag == null)
        return NotFound();

    Response.Headers.ETag = etag;
    Response.Headers.CacheControl = "public, max-age=3600";

    var ifNoneMatch = Request.Headers.IfNoneMatch.ToString();
    if (!string.IsNullOrEmpty(ifNoneMatch) && ifNoneMatch.Contains(etag))
        return StatusCode(StatusCodes.Status304NotModified);

    var content = await _summaryCardService.GetCardAsync(id);
    if (content == null)
        return NotFound();

    Response.Headers.LastModified = content.LastModified.ToString("R");
    return File(content.Bytes, "image/png");
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `dotnet test SorobanSecurityPortalApi.Tests --filter OgControllerTests`
Expected: PASS (all OgController tests, incl. the 3 new ones).

- [ ] **Step 5: Run the full backend test suite**

Run: `dotnet test SorobanSecurityPortalApi.Tests`
Expected: all tests pass (no regressions).

- [ ] **Step 6: Commit**

```bash
git add Backend/SorobanSecurityPortalApi/Controllers/OgController.cs \
        Backend/SorobanSecurityPortalApi.Tests/Controllers/OgControllerTests.cs
git commit -m "feat(og): serve report summary card as og:image for report links"
```

---

## Manual verification (after deploy)

Crawler-UA fetch of the report page returns OG html whose `og:image` is the summary endpoint,
and that endpoint returns a PNG:

```bash
# OG html (note og:image points at summary.png)
curl -s -A "Twitterbot/1.0" https://<host>/report/64 | grep -o 'og:image[^>]*'
# The card itself
curl -s -A "Twitterbot/1.0" https://<host>/api/v1/og/report/64/summary.png -o /tmp/card.png
file /tmp/card.png    # PNG image data, 1200 x 630
# 304 on repeat with the returned ETag
curl -s -D - -o /dev/null -H 'If-None-Match: "<etag-from-prev>"' https://<host>/api/v1/og/report/64/summary.png | head -1
```

Then paste the report URL into a Discord/Slack message (or a card validator) and confirm the
stats card renders. Numbers must equal the on-page Overview card for the same report.

---

## Self-Review Notes

- **Spec coverage:** stats semantics (Task 2) match the corrected spec (NotFixed = Total − Fixed);
  renderer 1200×630 + bundled font + zero-vuln "—" (Task 3); disk cache mirroring ReportImageService
  (Task 4); endpoint with 304 + og:image switch + removed PDF cover (Task 5). Tests cover each.
- **Type consistency:** `ReportSummaryMeta`/`ReportSummaryStats` (Task 2) are consumed unchanged by
  Tasks 3-5; `IReportSummaryCardService.GetCardAsync`/`GetETagAsync` + `ReportSummaryCardContent`
  used identically in service (Task 4) and controller/tests (Task 5).
- **DI:** all three new `I*` services are picked up by the convention scan in `Startup.cs`; the
  renderer holds its typeface in static fields (loaded once) so transient lifetime is cheap.
- **Edge:** card endpoint returns 404 for unapproved/missing reports; OG html still routes those to
  `Generic()` (logo), so no broken-image previews.

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
        private static readonly SKColor TotalColor = new(0xE5, 0xA8, 0x3A);   // amber
        private static readonly SKColor FixedColor = new(0x3F, 0xC1, 0x6A);   // green
        private static readonly SKColor NotFixedColor = new(0xE5, 0x4B, 0x4B); // red
        private static readonly SKColor RateColor = new(0x4F, 0x9C, 0xF0);    // blue

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
            DrawStat(canvas, 0, s.Total.ToString(), "Total", TotalColor);
            DrawStat(canvas, 1, s.Fixed.ToString(), "Fixed", FixedColor);
            DrawStat(canvas, 2, s.NotFixed.ToString(), "Not Fixed", NotFixedColor);
            DrawStat(canvas, 3, s.Total > 0 ? $"{s.FixedRate}%" : "—", "Fixed Rate", RateColor);

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

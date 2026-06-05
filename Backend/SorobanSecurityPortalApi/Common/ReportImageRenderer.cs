using PDFtoImage;
using SkiaSharp;

namespace SorobanSecurityPortalApi.Common
{
    // Renders a report's header thumbnail from the first page of its PDF. Shared by the normal
    // report add/update flow and the agent-ingestion approve flow so agent-created reports get
    // the same first-page image (otherwise admin/reports and the public preview show a broken image).
    public static class ReportImageRenderer
    {
        public static byte[] RenderFirstPageAsPng(byte[] file, int dpi = 150)
        {
            var bitmap = Conversion.ToImage(file, 0);
            using var image = SKImage.FromBitmap(bitmap);
            using var data = image.Encode(SKEncodedImageFormat.Png, 100);
            return data.ToArray();
        }

        // Best-effort variant for callers that must not fail on a bad/unreadable PDF (e.g. approve).
        public static byte[]? TryRenderFirstPageAsPng(byte[]? file, int dpi = 150)
        {
            if (file == null || file.Length == 0) return null;
            try { return RenderFirstPageAsPng(file, dpi); }
            catch { return null; }
        }
    }
}

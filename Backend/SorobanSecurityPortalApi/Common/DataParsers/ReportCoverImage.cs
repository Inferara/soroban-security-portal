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

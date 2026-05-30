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

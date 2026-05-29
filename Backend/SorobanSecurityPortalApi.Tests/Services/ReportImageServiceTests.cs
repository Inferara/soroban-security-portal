using System;
using System.IO;
using System.Threading.Tasks;
using Moq;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Services.ControllersServices;
using Xunit;

namespace SorobanSecurityPortalApi.Tests.Services
{
    public class ReportImageServiceTests : IDisposable
    {
        private readonly Mock<IReportProcessor> _processor = new();
        private readonly Mock<IExtendedConfig> _config = new();
        private readonly string _cacheDir;

        public ReportImageServiceTests()
        {
            _cacheDir = Path.Combine(Path.GetTempPath(), "soroban-img-test-" + Guid.NewGuid().ToString("N"));
            _config.Setup(c => c.ReportImageCacheDir).Returns(_cacheDir);
        }

        public void Dispose()
        {
            if (Directory.Exists(_cacheDir))
                Directory.Delete(_cacheDir, recursive: true);
        }

        private ReportImageService Create() => new(_processor.Object, _config.Object);

        [Fact]
        public async Task GetImageMetaAsync_ReturnsNull_WhenNoImage()
        {
            _processor.Setup(p => p.GetImageLastModified(7)).ReturnsAsync((DateTime?)null);
            var result = await Create().GetImageMetaAsync(7);
            result.Should().BeNull();
        }

        [Fact]
        public async Task GetImageMetaAsync_BuildsStableETagFromTimestamp()
        {
            var ts = new DateTime(2026, 1, 2, 3, 4, 5, DateTimeKind.Utc);
            _processor.Setup(p => p.GetImageLastModified(7)).ReturnsAsync(ts);
            var result = await Create().GetImageMetaAsync(7);
            result!.ETag.Should().Be($"\"r7-{ts.Ticks}\"");
        }

        [Fact]
        public async Task GetImageContentAsync_ReadsFromDbThenCachesFile()
        {
            var ts = new DateTime(2026, 1, 2, 3, 4, 5, DateTimeKind.Utc);
            var png = new byte[] { 1, 2, 3, 4 };
            _processor.Setup(p => p.GetImageLastModified(7)).ReturnsAsync(ts);
            _processor.Setup(p => p.GetImageBytes(7)).ReturnsAsync(png);

            var svc = Create();
            var first = await svc.GetImageContentAsync(7);
            first!.Bytes.Should().Equal(png);

            // Second call must come from disk, not the DB.
            _processor.Setup(p => p.GetImageBytes(7)).ThrowsAsync(new Exception("should not hit DB"));
            var second = await svc.GetImageContentAsync(7);
            second!.Bytes.Should().Equal(png);
            File.Exists(Path.Combine(_cacheDir, $"report-7-{ts.Ticks}.webp")).Should().BeTrue();
        }

        [Fact]
        public async Task GetImageContentAsync_ReturnsNull_WhenNoImage()
        {
            _processor.Setup(p => p.GetImageLastModified(7)).ReturnsAsync((DateTime?)null);
            var result = await Create().GetImageContentAsync(7);
            result.Should().BeNull();
        }
    }
}

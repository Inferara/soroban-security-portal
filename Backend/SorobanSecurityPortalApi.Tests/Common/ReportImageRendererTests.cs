using FluentAssertions;
using SorobanSecurityPortalApi.Common;
using Xunit;

namespace SorobanSecurityPortalApi.Tests.Common
{
    public class ReportImageRendererTests
    {
        [Fact]
        public void TryRenderFirstPageAsPng_Null_ReturnsNull()
            => ReportImageRenderer.TryRenderFirstPageAsPng(null).Should().BeNull();

        [Fact]
        public void TryRenderFirstPageAsPng_Empty_ReturnsNull()
            => ReportImageRenderer.TryRenderFirstPageAsPng(System.Array.Empty<byte>()).Should().BeNull();

        [Fact]
        public void TryRenderFirstPageAsPng_NotAPdf_ReturnsNull_DoesNotThrow()
            => ReportImageRenderer.TryRenderFirstPageAsPng(new byte[] { 1, 2, 3, 4, 5 }).Should().BeNull();
    }
}

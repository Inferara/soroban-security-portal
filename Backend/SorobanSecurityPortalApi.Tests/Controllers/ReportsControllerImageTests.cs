using System;
using System.Net.Http;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Moq;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Controllers;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Services.AgentServices;
using SorobanSecurityPortalApi.Services.ControllersServices;
using Xunit;

namespace SorobanSecurityPortalApi.Tests.Controllers
{
    public class ReportsControllerImageTests
    {
        private static ReportsController CreateController(
            Mock<IReportImageService> imageService,
            out DefaultHttpContext httpContext)
        {
            httpContext = new DefaultHttpContext();
            var userContext = new UserContextAccessor(
                Mock.Of<IHttpContextAccessor>(),
                Mock.Of<ILoginProcessor>());
            var controller = new ReportsController(
                Mock.Of<IReportService>(),
                Mock.Of<IVulnerabilityExtractionService>(),
                userContext,
                Mock.Of<IHttpClientFactory>(),
                Mock.Of<ILogger<ReportsController>>(),
                imageService.Object);
            controller.ControllerContext = new ControllerContext { HttpContext = httpContext };
            return controller;
        }

        [Fact]
        public async Task GetImage_ReturnsNotFound_WhenMetaNull()
        {
            var img = new Mock<IReportImageService>();
            img.Setup(s => s.GetImageMetaAsync(5)).ReturnsAsync((ReportImageMeta?)null);
            var controller = CreateController(img, out _);

            var result = await controller.GetImage(5);

            Assert.IsType<NotFoundResult>(result);
        }

        [Fact]
        public async Task GetImage_Returns304_WhenETagMatches()
        {
            var meta = new ReportImageMeta("\"r5-123\"", DateTimeOffset.UtcNow);
            var img = new Mock<IReportImageService>();
            img.Setup(s => s.GetImageMetaAsync(5)).ReturnsAsync(meta);
            var controller = CreateController(img, out var ctx);
            ctx.Request.Headers.IfNoneMatch = "\"r5-123\"";

            var result = await controller.GetImage(5);

            var status = Assert.IsType<StatusCodeResult>(result);
            Assert.Equal(StatusCodes.Status304NotModified, status.StatusCode);
            img.Verify(s => s.GetImageContentAsync(It.IsAny<int>()), Times.Never);
        }

        [Fact]
        public async Task GetImage_ReturnsFileWithHeaders_OnCacheMiss()
        {
            var meta = new ReportImageMeta("\"r5-123\"", DateTimeOffset.UtcNow);
            var img = new Mock<IReportImageService>();
            img.Setup(s => s.GetImageMetaAsync(5)).ReturnsAsync(meta);
            img.Setup(s => s.GetImageContentAsync(5))
               .ReturnsAsync(new ReportImageContent(new byte[] { 9, 9 }, meta.ETag, meta.LastModified));
            var controller = CreateController(img, out var ctx);

            var result = await controller.GetImage(5);

            var file = Assert.IsType<FileContentResult>(result);
            Assert.Equal("image/webp", file.ContentType);
            Assert.Equal("\"r5-123\"", ctx.Response.Headers.ETag.ToString());
            Assert.Equal("public, max-age=3600", ctx.Response.Headers.CacheControl.ToString());
        }
    }
}

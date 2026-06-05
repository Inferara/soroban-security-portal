using System.Net.Http;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Controllers;
using SorobanSecurityPortalApi.Data.Processors;
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

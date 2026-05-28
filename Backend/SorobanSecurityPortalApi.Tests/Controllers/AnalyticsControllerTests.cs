using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using SorobanSecurityPortalApi.Controllers;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;
using SorobanSecurityPortalApi.Services.ControllersServices;
using Xunit;

namespace SorobanSecurityPortalApi.Tests.Controllers
{
    public class AnalyticsControllerTests
    {
        private readonly Mock<IPageViewService> _svc = new();

        private AnalyticsController Sut(string? xff = null, string? ua = null)
        {
            var ctrl = new AnalyticsController(_svc.Object);
            var http = new DefaultHttpContext();
            if (xff != null) http.Request.Headers["X-Forwarded-For"] = xff;
            if (ua != null) http.Request.Headers.UserAgent = ua;
            ctrl.ControllerContext = new ControllerContext { HttpContext = http };
            return ctrl;
        }

        [Fact]
        public async Task RecordView_Valid_RecordsAndReturnsOk()
        {
            var result = await Sut(xff: "203.0.113.7, 10.0.0.1", ua: "Mozilla/5.0 Chrome/120")
                .RecordView(new AnalyticsController.RecordPageViewRequest { EntityType = EntityType.Report, EntityId = 9 });

            result.Should().BeOfType<OkResult>();
            // Uses the FIRST X-Forwarded-For hop as the client IP.
            _svc.Verify(s => s.RecordView(EntityType.Report, 9, "203.0.113.7", "Mozilla/5.0 Chrome/120", null), Times.Once);
        }

        [Fact]
        public async Task RecordView_InvalidEntityId_ReturnsBadRequest()
        {
            var result = await Sut().RecordView(new AnalyticsController.RecordPageViewRequest { EntityType = EntityType.Report, EntityId = 0 });
            result.Should().BeOfType<BadRequestObjectResult>();
            _svc.Verify(s => s.RecordView(It.IsAny<EntityType>(), It.IsAny<int>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<PageViewSource?>()), Times.Never);
        }

        [Fact]
        public async Task GetCounts_Valid_ReturnsCounts()
        {
            _svc.Setup(s => s.GetCounts(EntityType.Auditor, 4))
                .ReturnsAsync(new PageViewCountViewModel { Total = 5, Unique = 3 });

            var result = await Sut().GetCounts((int)EntityType.Auditor, 4);

            var ok = result.Should().BeOfType<OkObjectResult>().Subject;
            ok.Value.Should().BeOfType<PageViewCountViewModel>()
                .Which.Total.Should().Be(5);
        }

        [Fact]
        public async Task GetCounts_InvalidType_ReturnsBadRequest()
        {
            var result = await Sut().GetCounts(99, 4);
            result.Should().BeOfType<BadRequestObjectResult>();
        }

        [Fact]
        public async Task Statistics_ReturnsServiceResult()
        {
            _svc.Setup(s => s.GetStatistics()).ReturnsAsync(new AnalyticsStatisticsViewModel { TotalHumanViews = 42 });
            var result = await Sut().Statistics();
            var ok = result.Should().BeOfType<OkObjectResult>().Subject;
            ok.Value.Should().BeOfType<AnalyticsStatisticsViewModel>().Which.TotalHumanViews.Should().Be(42);
        }
    }
}

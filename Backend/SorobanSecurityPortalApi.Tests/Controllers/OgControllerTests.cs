using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Moq;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Controllers;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;
using SorobanSecurityPortalApi.Services.ControllersServices;
using Xunit;

namespace SorobanSecurityPortalApi.Tests.Controllers
{
    public class OgControllerTests
    {
        private readonly Mock<IVulnerabilityService> _vuln = new();
        private readonly Mock<IReportService> _report = new();
        private readonly Mock<IPageViewService> _pageViews = new();
        private readonly Mock<IReportSummaryCardService> _cards = new();
        // Config's constructor validates every key, so supply a complete settings blob.
        private readonly Config _config = new(@"{
            ""ProductVersion"": ""1.0"",
            ""DbConnectionTimeout"": 30,
            ""DbServer"": ""localhost"",
            ""DbPort"": 5432,
            ""DbName"": ""db"",
            ""DbUser"": ""u"",
            ""DbPassword"": ""p"",
            ""DbTimeout"": 30,
            ""DbPgPoolSize"": 10,
            ""AutoCompactLargeObjectHeap"": false,
            ""DistributedCacheUrl"": ""localhost"",
            ""DistributedCachePassword"": ""x"",
            ""AppUrl"": ""https://sorobanshield.ru/api/v1""
        }");

        private OgController Sut()
        {
            var ctrl = new OgController(_vuln.Object, _report.Object, _config, _pageViews.Object, _cards.Object);
            ctrl.ControllerContext = new Microsoft.AspNetCore.Mvc.ControllerContext
            { HttpContext = new Microsoft.AspNetCore.Http.DefaultHttpContext() };
            return ctrl;
        }

        private static string Body(IActionResult r) => ((ContentResult)r).Content!;

        [Fact]
        public async Task Vulnerability_Approved_EmitsOgTagsWithTitleAndCanonicalUrl()
        {
            _vuln.Setup(s => s.Get(7)).ReturnsAsync(new VulnerabilityViewModel
            { Id = 7, Title = "Reentrancy in vault", Description = "A bad bug.", Status = "approved", Category = VulnerabilityCategory.Valid });
            var body = Body(await Sut().Vulnerability(7));
            body.Should().Contain("<meta property=\"og:title\" content=\"Reentrancy in vault\">");
            body.Should().Contain("<meta property=\"og:url\" content=\"https://sorobanshield.ru/vulnerability/7\">");
            body.Should().Contain("twitter:card");
        }

        [Fact]
        public async Task Vulnerability_NotApproved_ReturnsGenericMeta_NoLeak()
        {
            _vuln.Setup(s => s.Get(7)).ReturnsAsync(new VulnerabilityViewModel
            { Id = 7, Title = "Secret pending bug", Description = "hidden", Status = "new", Category = VulnerabilityCategory.Valid });
            var body = Body(await Sut().Vulnerability(7));
            body.Should().NotContain("Secret pending bug");
            body.Should().Contain("Stellar Security Portal");
        }

        [Fact]
        public async Task Vulnerability_Missing_ReturnsGenericMeta()
        {
            _vuln.Setup(s => s.Get(It.IsAny<int>())).ReturnsAsync((VulnerabilityViewModel)null!);
            var body = Body(await Sut().Vulnerability(999));
            body.Should().Contain("og:site_name");
            body.Should().Contain("Stellar Security Portal");
        }

        [Fact]
        public async Task Vulnerability_EscapesHtmlInTitleAndDescription()
        {
            _vuln.Setup(s => s.Get(7)).ReturnsAsync(new VulnerabilityViewModel
            { Id = 7, Title = "<script>alert(1)</script>", Description = "\"><img src=x>", Status = "approved", Category = VulnerabilityCategory.Valid });
            var body = Body(await Sut().Vulnerability(7));
            body.Should().NotContain("<script>alert(1)</script>");
            body.Should().Contain("&lt;script&gt;");
        }

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

        [Fact]
        public async Task Report_NotApproved_ReturnsGenericMeta()
        {
            _report.Setup(s => s.Get(3)).ReturnsAsync(new ReportViewModel { Id = 3, Name = "Draft", Status = "new" });
            var body = Body(await Sut().Report(3));
            body.Should().NotContain("Draft");
        }

        [Fact]
        public async Task Vulnerability_RecordingThrows_StillReturnsOgHtml()
        {
            _vuln.Setup(s => s.Get(7)).ReturnsAsync(new VulnerabilityViewModel
            { Id = 7, Title = "Reentrancy", Description = "bug", Status = "approved", Category = VulnerabilityCategory.Valid });
            _pageViews.Setup(p => p.RecordView(It.IsAny<EntityType>(), It.IsAny<int>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<PageViewSource?>()))
                      .ThrowsAsync(new Exception("db down"));

            var body = Body(await Sut().Vulnerability(7));

            body.Should().Contain("og:title");
        }

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
    }
}

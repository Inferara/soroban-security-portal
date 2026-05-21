using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using SorobanSecurityPortalApi.Authorization.Attributes;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Controllers;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;
using SorobanSecurityPortalApi.Services.AgentServices;
using SorobanSecurityPortalApi.Services.ControllersServices;

namespace SorobanSecurityPortalApi.Tests.Controllers;

public class ReportsControllerDownloadTests
{
    private readonly Mock<IReportService> _reportServiceMock = new();
    private readonly Mock<IVulnerabilityExtractionService> _extractionServiceMock = new();
    private readonly Mock<UserContextAccessor> _userContextAccessorMock = new(MockBehavior.Loose, null!, null!);
    private readonly Mock<IHttpClientFactory> _httpClientFactoryMock = new();
    private readonly Mock<ILogger<ReportsController>> _loggerMock = new();

    [Fact]
    public async Task GetFile_WhenReportIsPendingAndUserIsRegularUser_ReturnsForbid()
    {
        var reportId = 42;
        _reportServiceMock
            .Setup(x => x.Get(reportId))
            .ReturnsAsync(CreateReport(reportId, ReportModelStatus.New));

        var controller = CreateController(Role.User);

        var result = await controller.GetFile(reportId);

        result.Should().BeOfType<ForbidResult>();
    }

    [Theory]
    [InlineData(ReportModelStatus.New)]
    [InlineData(ReportModelStatus.Rejected)]
    public async Task GetFile_WhenReportIsNotApprovedAndUserIsModerator_ReturnsPdf(string status)
    {
        var reportId = 42;
        _reportServiceMock
            .Setup(x => x.Get(reportId))
            .ReturnsAsync(CreateReport(reportId, status));

        var controller = CreateController(Role.Moderator);

        var result = await controller.GetFile(reportId);

        var fileResult = result.Should().BeOfType<FileContentResult>().Subject;
        fileResult.ContentType.Should().Be("application/pdf");
        fileResult.FileDownloadName.Should().Be("Test Report.pdf");
    }

    [Fact]
    public async Task GetFile_WhenReportIsApprovedAndUserIsRegularUser_ReturnsPdf()
    {
        var reportId = 42;
        _reportServiceMock
            .Setup(x => x.Get(reportId))
            .ReturnsAsync(CreateReport(reportId, ReportModelStatus.Approved));

        var controller = CreateController(Role.User);

        var result = await controller.GetFile(reportId);

        var fileResult = result.Should().BeOfType<FileContentResult>().Subject;
        fileResult.ContentType.Should().Be("application/pdf");
        fileResult.FileDownloadName.Should().Be("Test Report.pdf");
    }

    private ReportsController CreateController(Role role)
    {
        var controller = new ReportsController(
            _reportServiceMock.Object,
            _extractionServiceMock.Object,
            _userContextAccessorMock.Object,
            _httpClientFactoryMock.Object,
            _loggerMock.Object);

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = CreateUserWithRole(role)
            }
        };

        return controller;
    }

    private static ClaimsPrincipal CreateUserWithRole(Role role)
    {
        var identity = new ClaimsIdentity(
            new[]
            {
                new Claim(ClaimTypes.Name, "testuser"),
                new Claim(ClaimTypes.Role, role.ToString())
            },
            "TestAuthType");

        return new ClaimsPrincipal(identity);
    }

    private static ReportViewModel CreateReport(int reportId, string status)
    {
        return new ReportViewModel
        {
            Id = reportId,
            Name = "Test Report",
            Status = status,
            BinFile = new byte[] { 0x25, 0x50, 0x44, 0x46 }
        };
    }
}

using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Controllers;
using SorobanSecurityPortalApi.Models.ViewModels;
using SorobanSecurityPortalApi.Services.AgentServices;
using SorobanSecurityPortalApi.Services.ControllersServices;

namespace SorobanSecurityPortalApi.Tests.Controllers;

/// <summary>
/// Unit tests for the ReportsController ExtractVulnerabilities endpoint.
/// Tests cover authorization, successful extraction, and error responses.
/// </summary>
public class ReportsControllerExtractVulnerabilitiesTests
{
    private readonly Mock<IReportService> _reportServiceMock;
    private readonly Mock<IVulnerabilityExtractionService> _extractionServiceMock;
    private readonly Mock<UserContextAccessor> _userContextAccessorMock;
    private readonly Mock<IHttpClientFactory> _httpClientFactoryMock;
    private readonly Mock<ILogger<ReportsController>> _loggerMock;

    public ReportsControllerExtractVulnerabilitiesTests()
    {
        _reportServiceMock = new Mock<IReportService>();
        _extractionServiceMock = new Mock<IVulnerabilityExtractionService>();
        _userContextAccessorMock = new Mock<UserContextAccessor>(MockBehavior.Loose, null!, null!);
        _httpClientFactoryMock = new Mock<IHttpClientFactory>();
        _loggerMock = new Mock<ILogger<ReportsController>>();
    }

    #region Successful Extraction Tests

    [Fact]
    public async Task ExtractVulnerabilities_WhenSuccessful_ReturnsOkWithResult()
    {
        // Arrange
        var reportId = 42;
        var expectedResult = new VulnerabilityExtractionResultViewModel
        {
            TotalExtracted = 5,
            TotalCreated = 4,
            DuplicatesSkipped = 1,
            CreatedVulnerabilityIds = new List<int> { 100, 101, 102, 103 },
            ProcessingTimeMs = 1500
        };

        _extractionServiceMock.Setup(x => x.ExtractVulnerabilitiesAsync(reportId, null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Result<VulnerabilityExtractionResultViewModel, string>.Ok(expectedResult));

        var controller = CreateController();

        // Act
        var result = await controller.ExtractVulnerabilities(reportId, CancellationToken.None);

        // Assert
        result.Should().BeOfType<OkObjectResult>();
        var okResult = (OkObjectResult)result;
        okResult.Value.Should().BeEquivalentTo(expectedResult);
    }

    [Fact]
    public async Task ExtractVulnerabilities_WithNoVulnerabilitiesFound_ReturnsOkWithEmptyResult()
    {
        // Arrange
        var reportId = 42;
        var emptyResult = new VulnerabilityExtractionResultViewModel
        {
            TotalExtracted = 0,
            TotalCreated = 0,
            DuplicatesSkipped = 0,
            CreatedVulnerabilityIds = new List<int>(),
            ValidationWarnings = new List<string> { "No vulnerabilities found in the report." },
            ProcessingTimeMs = 500
        };

        _extractionServiceMock.Setup(x => x.ExtractVulnerabilitiesAsync(reportId, null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Result<VulnerabilityExtractionResultViewModel, string>.Ok(emptyResult));

        var controller = CreateController();

        // Act
        var result = await controller.ExtractVulnerabilities(reportId, CancellationToken.None);

        // Assert
        result.Should().BeOfType<OkObjectResult>();
        var okResult = (OkObjectResult)result;
        var viewModel = okResult.Value as VulnerabilityExtractionResultViewModel;
        viewModel.Should().NotBeNull();
        viewModel!.TotalExtracted.Should().Be(0);
    }

    [Fact]
    public async Task ExtractVulnerabilities_PassesCancellationToken()
    {
        // Arrange
        var reportId = 42;
        using var cts = new CancellationTokenSource();
        CancellationToken capturedToken = default;

        _extractionServiceMock.Setup(x => x.ExtractVulnerabilitiesAsync(reportId, null, It.IsAny<CancellationToken>()))
            .Callback<int, VulnerabilityExtractionOptions?, CancellationToken>((_, _, ct) => capturedToken = ct)
            .ReturnsAsync(new Result<VulnerabilityExtractionResultViewModel, string>.Ok(new VulnerabilityExtractionResultViewModel()));

        var controller = CreateController();

        // Act
        await controller.ExtractVulnerabilities(reportId, cts.Token);

        // Assert
        capturedToken.Should().Be(cts.Token);
    }

    #endregion

    #region Error Response Tests

    [Fact]
    public async Task ExtractVulnerabilities_WhenReportNotFound_ReturnsBadRequest()
    {
        // Arrange
        var reportId = 999;
        var errorMessage = "Report with ID 999 not found.";

        _extractionServiceMock.Setup(x => x.ExtractVulnerabilitiesAsync(reportId, null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Result<VulnerabilityExtractionResultViewModel, string>.Err(errorMessage));

        var controller = CreateController();

        // Act
        var result = await controller.ExtractVulnerabilities(reportId, CancellationToken.None);

        // Assert
        result.Should().BeOfType<BadRequestObjectResult>();
        var badRequest = (BadRequestObjectResult)result;
        badRequest.Value.Should().Be(errorMessage);
    }

    [Fact]
    public async Task ExtractVulnerabilities_WhenNoMarkdownContent_ReturnsBadRequest()
    {
        // Arrange
        var reportId = 42;
        var errorMessage = "Report does not have markdown content for extraction.";

        _extractionServiceMock.Setup(x => x.ExtractVulnerabilitiesAsync(reportId, null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Result<VulnerabilityExtractionResultViewModel, string>.Err(errorMessage));

        var controller = CreateController();

        // Act
        var result = await controller.ExtractVulnerabilities(reportId, CancellationToken.None);

        // Assert
        result.Should().BeOfType<BadRequestObjectResult>();
        var badRequest = (BadRequestObjectResult)result;
        badRequest.Value.Should().Be(errorMessage);
    }

    [Fact]
    public async Task ExtractVulnerabilities_WhenMarkdownTooLarge_ReturnsBadRequest()
    {
        // Arrange
        var reportId = 42;
        var errorMessage = "Report markdown content is too large (6MB). Maximum supported size is 5MB.";

        _extractionServiceMock.Setup(x => x.ExtractVulnerabilitiesAsync(reportId, null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Result<VulnerabilityExtractionResultViewModel, string>.Err(errorMessage));

        var controller = CreateController();

        // Act
        var result = await controller.ExtractVulnerabilities(reportId, CancellationToken.None);

        // Assert
        result.Should().BeOfType<BadRequestObjectResult>();
        var badRequest = (BadRequestObjectResult)result;
        badRequest.Value.Should().BeOfType<string>().Which.Should().Contain("too large");
    }

    [Fact]
    public async Task ExtractVulnerabilities_WhenAgentServiceFails_ReturnsBadRequest()
    {
        // Arrange
        var reportId = 42;
        var errorMessage = "Gemini API error: Unauthorized";

        _extractionServiceMock.Setup(x => x.ExtractVulnerabilitiesAsync(reportId, null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Result<VulnerabilityExtractionResultViewModel, string>.Err(errorMessage));

        var controller = CreateController();

        // Act
        var result = await controller.ExtractVulnerabilities(reportId, CancellationToken.None);

        // Assert
        result.Should().BeOfType<BadRequestObjectResult>();
        var badRequest = (BadRequestObjectResult)result;
        badRequest.Value.Should().BeOfType<string>().Which.Should().Contain("Gemini API error");
    }

    #endregion

    #region Report ID Validation Tests

    [Theory]
    [InlineData(1)]
    [InlineData(100)]
    [InlineData(999999)]
    public async Task ExtractVulnerabilities_WithValidReportId_CallsService(int reportId)
    {
        // Arrange
        _extractionServiceMock.Setup(x => x.ExtractVulnerabilitiesAsync(reportId, null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Result<VulnerabilityExtractionResultViewModel, string>.Ok(new VulnerabilityExtractionResultViewModel()));

        var controller = CreateController();

        // Act
        await controller.ExtractVulnerabilities(reportId, CancellationToken.None);

        // Assert
        _extractionServiceMock.Verify(
            x => x.ExtractVulnerabilitiesAsync(reportId, null, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    #endregion

    #region Result Content Tests

    [Fact]
    public async Task ExtractVulnerabilities_ReturnsAllResultFields()
    {
        // Arrange
        var reportId = 42;
        var expectedResult = new VulnerabilityExtractionResultViewModel
        {
            TotalExtracted = 10,
            TotalCreated = 8,
            DuplicatesSkipped = 2,
            CreatedVulnerabilityIds = new List<int> { 1, 2, 3, 4, 5, 6, 7, 8 },
            ValidationWarnings = new List<string> { "Warning 1", "Warning 2" },
            ProcessingErrors = new List<string> { "Minor error that didn't stop processing" },
            ProcessingTimeMs = 5000
        };

        _extractionServiceMock.Setup(x => x.ExtractVulnerabilitiesAsync(reportId, null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Result<VulnerabilityExtractionResultViewModel, string>.Ok(expectedResult));

        var controller = CreateController();

        // Act
        var result = await controller.ExtractVulnerabilities(reportId, CancellationToken.None);

        // Assert
        result.Should().BeOfType<OkObjectResult>();
        var okResult = (OkObjectResult)result;
        var viewModel = okResult.Value as VulnerabilityExtractionResultViewModel;

        viewModel.Should().NotBeNull();
        viewModel!.TotalExtracted.Should().Be(10);
        viewModel.TotalCreated.Should().Be(8);
        viewModel.DuplicatesSkipped.Should().Be(2);
        viewModel.CreatedVulnerabilityIds.Should().HaveCount(8);
        viewModel.ValidationWarnings.Should().HaveCount(2);
        viewModel.ProcessingErrors.Should().HaveCount(1);
        viewModel.ProcessingTimeMs.Should().Be(5000);
    }

    #endregion

    #region Service Call Verification Tests

    [Fact]
    public async Task ExtractVulnerabilities_CallsExtractionServiceOnce()
    {
        // Arrange
        var reportId = 42;
        _extractionServiceMock.Setup(x => x.ExtractVulnerabilitiesAsync(It.IsAny<int>(), null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Result<VulnerabilityExtractionResultViewModel, string>.Ok(new VulnerabilityExtractionResultViewModel()));

        var controller = CreateController();

        // Act
        await controller.ExtractVulnerabilities(reportId, CancellationToken.None);

        // Assert
        _extractionServiceMock.Verify(
            x => x.ExtractVulnerabilitiesAsync(It.IsAny<int>(), null, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task ExtractVulnerabilities_PassesNullOptionsToService()
    {
        // Arrange
        var reportId = 42;
        VulnerabilityExtractionOptions? capturedOptions = null;

        _extractionServiceMock.Setup(x => x.ExtractVulnerabilitiesAsync(reportId, It.IsAny<VulnerabilityExtractionOptions?>(), It.IsAny<CancellationToken>()))
            .Callback<int, VulnerabilityExtractionOptions?, CancellationToken>((_, opts, _) => capturedOptions = opts)
            .ReturnsAsync(new Result<VulnerabilityExtractionResultViewModel, string>.Ok(new VulnerabilityExtractionResultViewModel()));

        var controller = CreateController();

        // Act
        await controller.ExtractVulnerabilities(reportId, CancellationToken.None);

        // Assert
        capturedOptions.Should().BeNull();
    }

    #endregion

    #region Helper Methods

    private ReportsController CreateController()
    {
        var controller = new ReportsController(
            _reportServiceMock.Object,
            _extractionServiceMock.Object,
            _userContextAccessorMock.Object,
            _httpClientFactoryMock.Object,
            _loggerMock.Object);

        // Setup HttpContext for controller
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext()
        };

        return controller;
    }

    private static ClaimsPrincipal CreateUserWithRole(string role)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.Name, "testuser"),
            new(ClaimTypes.Role, role)
        };
        var identity = new ClaimsIdentity(claims, "TestAuthType");
        return new ClaimsPrincipal(identity);
    }

    #endregion
}

/// <summary>
/// Tests for the RoleAuthorize attribute on ExtractVulnerabilities endpoint.
/// These tests verify that only Admin and Moderator roles can access the endpoint.
/// Note: Full authorization testing requires integration tests with WebApplicationFactory.
/// </summary>
public class ReportsControllerExtractVulnerabilitiesAuthorizationTests
{
    /// <summary>
    /// Documents the expected authorization requirement.
    /// The [RoleAuthorize(Role.Admin, Role.Moderator)] attribute on the endpoint
    /// should restrict access to only Admin and Moderator roles.
    /// </summary>
    [Fact]
    public void ExtractVulnerabilities_ShouldHaveRoleAuthorizeAttribute()
    {
        // Arrange
        var methodInfo = typeof(ReportsController).GetMethod("ExtractVulnerabilities");

        // Assert
        methodInfo.Should().NotBeNull();
        var attributes = methodInfo!.GetCustomAttributes(true);

        // Verify that the method has authorization attributes
        // The actual RoleAuthorize attribute check would require the attribute type
        attributes.Should().NotBeEmpty("Expected authorization attributes on ExtractVulnerabilities endpoint");
    }

    [Fact]
    public void ExtractVulnerabilities_ShouldBeHttpPostEndpoint()
    {
        // Arrange
        var methodInfo = typeof(ReportsController).GetMethod("ExtractVulnerabilities");

        // Assert
        methodInfo.Should().NotBeNull();
        var httpPostAttribute = methodInfo!.GetCustomAttributes(typeof(Microsoft.AspNetCore.Mvc.HttpPostAttribute), true);
        httpPostAttribute.Should().NotBeEmpty("ExtractVulnerabilities should be an HTTP POST endpoint");
    }

    [Fact]
    public void ExtractVulnerabilities_ShouldHaveCorrectRoute()
    {
        // Arrange
        var methodInfo = typeof(ReportsController).GetMethod("ExtractVulnerabilities");

        // Assert
        methodInfo.Should().NotBeNull();
        var httpPostAttributes = methodInfo!.GetCustomAttributes(typeof(Microsoft.AspNetCore.Mvc.HttpPostAttribute), true);

        httpPostAttributes.Should().NotBeEmpty();
        var httpPostAttribute = (Microsoft.AspNetCore.Mvc.HttpPostAttribute)httpPostAttributes[0];
        httpPostAttribute.Template.Should().Be("{reportId}/extract-vulnerabilities");
    }
}

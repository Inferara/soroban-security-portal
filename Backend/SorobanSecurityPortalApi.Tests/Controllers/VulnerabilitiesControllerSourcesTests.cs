using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Controllers;
using SorobanSecurityPortalApi.Models.ViewModels;
using SorobanSecurityPortalApi.Services.ControllersServices;

namespace SorobanSecurityPortalApi.Tests.Controllers
{
    public class VulnerabilitiesControllerSourcesTests
    {
        [Fact]
        public async Task ListSources_WhenIncludeNotApprovedIsFalse_ReturnsSourcesWithoutAuth()
        {
            var sources = new List<IdValueUrl> { new() { Id = 1, Name = "Approved" } };
            var service = new Mock<IVulnerabilityService>();
            service.Setup(s => s.ListSources(false)).ReturnsAsync(sources);

            var controller = CreateController(service.Object);

            var result = await controller.ListSources(includeNotApproved: false);

            var ok = Assert.IsType<OkObjectResult>(result);
            Assert.Same(sources, ok.Value);
            service.Verify(s => s.ListSources(false), Times.Once);
        }

        [Fact]
        public async Task ListSources_WhenIncludeNotApprovedIsTrue_AndUserIsAnonymous_ReturnsUnauthorized()
        {
            var service = new Mock<IVulnerabilityService>();
            var controller = CreateController(service.Object);

            var result = await controller.ListSources(includeNotApproved: true);

            Assert.IsType<UnauthorizedResult>(result);
            service.Verify(s => s.ListSources(It.IsAny<bool>()), Times.Never);
        }

        [Fact]
        public async Task ListSources_WhenIncludeNotApprovedIsTrue_AndUserIsContributor_ReturnsForbid()
        {
            var service = new Mock<IVulnerabilityService>();
            var controller = CreateController(service.Object, CreateUserWithRole(Role.Contributor));

            var result = await controller.ListSources(includeNotApproved: true);

            Assert.IsType<ForbidResult>(result);
            service.Verify(s => s.ListSources(It.IsAny<bool>()), Times.Never);
        }

        [Fact]
        public async Task ListSources_WhenIncludeNotApprovedIsTrue_AndUserIsModerator_ReturnsSources()
        {
            var sources = new List<IdValueUrl> { new() { Id = 2, Name = "Pending" } };
            var service = new Mock<IVulnerabilityService>();
            service.Setup(s => s.ListSources(true)).ReturnsAsync(sources);

            var controller = CreateController(service.Object, CreateUserWithRole(Role.Moderator));

            var result = await controller.ListSources(includeNotApproved: true);

            var ok = Assert.IsType<OkObjectResult>(result);
            Assert.Same(sources, ok.Value);
            service.Verify(s => s.ListSources(true), Times.Once);
        }

        private static VulnerabilitiesController CreateController(
            IVulnerabilityService service,
            ClaimsPrincipal? user = null)
        {
            return new VulnerabilitiesController(service)
            {
                ControllerContext = new ControllerContext
                {
                    HttpContext = new DefaultHttpContext
                    {
                        User = user ?? new ClaimsPrincipal(new ClaimsIdentity())
                    }
                }
            };
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
    }
}

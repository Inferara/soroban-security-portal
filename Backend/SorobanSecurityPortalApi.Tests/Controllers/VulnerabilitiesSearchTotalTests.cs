using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using SorobanSecurityPortalApi.Controllers;
using SorobanSecurityPortalApi.Models.ViewModels;
using SorobanSecurityPortalApi.Services.ControllersServices;
using Moq;
using Xunit;

namespace SorobanSecurityPortalApi.Tests.Controllers
{
    public class VulnerabilitiesSearchTotalTests
    {
        [Fact]
        public async Task Search_ReturnsItems_AndSetsXTotalCountHeader()
        {
            var items = new List<VulnerabilityViewModel> { new() { Id = 1 }, new() { Id = 2 } };
            var svc = new Mock<IVulnerabilityService>();
            svc.Setup(s => s.SearchWithTotal(It.IsAny<VulnerabilitySearchViewModel?>()))
               .ReturnsAsync((items, 57));
            var controller = new VulnerabilitiesController(svc.Object)
            {
                ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }
            };

            var result = await controller.Search(new VulnerabilitySearchViewModel());

            var ok = Assert.IsType<OkObjectResult>(result);
            Assert.Same(items, ok.Value);
            Assert.Equal("57", controller.Response.Headers["X-Total-Count"].ToString());
            svc.Verify(s => s.SearchWithTotal(It.IsAny<VulnerabilitySearchViewModel?>()), Times.Once);
        }
    }
}

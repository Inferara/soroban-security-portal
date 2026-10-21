using System.Collections.Generic;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using SorobanSecurityPortalApi.Controllers;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.ViewModels;
using SorobanSecurityPortalApi.Services.ControllersServices;
using Xunit;

namespace SorobanSecurityPortalApi.Tests.Controllers
{
    // The anonymous search endpoints are the only HTTP path into VulnerabilityProcessor.Search.
    // They must never forward a "give me everything" page size (negative) or anything above
    // MaxPageSize, while leaving ordinary UI paging untouched (issue #223).
    public class VulnerabilitiesControllerPagingTests
    {
        private static (VulnerabilitiesController Controller, Mock<IVulnerabilityService> Service) Build()
        {
            var svc = new Mock<IVulnerabilityService>();
            svc.Setup(s => s.SearchWithTotal(It.IsAny<VulnerabilitySearchViewModel?>()))
               .ReturnsAsync((new List<VulnerabilityViewModel>(), 0));
            svc.Setup(s => s.SearchTotal(It.IsAny<VulnerabilitySearchViewModel?>()))
               .ReturnsAsync(0);
            var controller = new VulnerabilitiesController(svc.Object)
            {
                ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }
            };
            return (controller, svc);
        }

        [Theory]
        [InlineData(-1)]
        [InlineData(-1_000)]
        [InlineData(0)]
        public async Task Search_Resets_NonPositive_PageSize_So_Processor_Applies_Its_Default(int pageSize)
        {
            var (controller, svc) = Build();
            var search = new VulnerabilitySearchViewModel { PageSize = pageSize };

            await controller.Search(search);

            svc.Verify(s => s.SearchWithTotal(It.Is<VulnerabilitySearchViewModel>(m => m.PageSize == null)), Times.Once);
        }

        [Fact]
        public async Task Search_Caps_Oversized_PageSize_At_MaxPageSize()
        {
            var (controller, svc) = Build();

            await controller.Search(new VulnerabilitySearchViewModel { PageSize = 1_000_000 });

            svc.Verify(s => s.SearchWithTotal(
                It.Is<VulnerabilitySearchViewModel>(m => m.PageSize == VulnerabilityProcessor.MaxPageSize)), Times.Once);
        }

        [Theory]
        [InlineData(10)]
        [InlineData(20)]
        [InlineData(50)]
        [InlineData(100)]
        public async Task Search_Leaves_Normal_UI_PageSizes_Unchanged(int pageSize)
        {
            var (controller, svc) = Build();

            await controller.Search(new VulnerabilitySearchViewModel { Page = 3, PageSize = pageSize });

            svc.Verify(s => s.SearchWithTotal(
                It.Is<VulnerabilitySearchViewModel>(m => m.PageSize == pageSize && m.Page == 3)), Times.Once);
        }

        [Theory]
        [InlineData(0)]
        [InlineData(-5)]
        public async Task Search_Resets_NonPositive_Page(int page)
        {
            var (controller, svc) = Build();

            await controller.Search(new VulnerabilitySearchViewModel { Page = page, PageSize = 20 });

            svc.Verify(s => s.SearchWithTotal(
                It.Is<VulnerabilitySearchViewModel>(m => m.Page == null && m.PageSize == 20)), Times.Once);
        }

        [Fact]
        public async Task Search_Tolerates_Missing_Body()
        {
            var (controller, svc) = Build();

            var result = await controller.Search(null);

            result.Should().BeOfType<OkObjectResult>();
            svc.Verify(s => s.SearchWithTotal(null), Times.Once);
        }

        [Fact]
        public async Task SearchTotal_Applies_The_Same_Normalization()
        {
            var (controller, svc) = Build();

            await controller.SearchTotal(new VulnerabilitySearchViewModel { Page = -1, PageSize = -1 });

            svc.Verify(s => s.SearchTotal(
                It.Is<VulnerabilitySearchViewModel>(m => m.Page == null && m.PageSize == null)), Times.Once);
        }

        [Fact]
        public void NormalizeClientPaging_Does_Not_Touch_Other_Filters()
        {
            var search = new VulnerabilitySearchViewModel
            {
                Page = -1,
                PageSize = 999,
                Severities = new List<string> { "High" },
                SearchText = "reentrancy",
                IncludeDescription = false,
            };

            VulnerabilitiesController.NormalizeClientPaging(search);

            search.Page.Should().BeNull();
            search.PageSize.Should().Be(VulnerabilityProcessor.MaxPageSize);
            search.Severities.Should().Equal("High");
            search.SearchText.Should().Be("reentrancy");
            search.IncludeDescription.Should().BeFalse();
        }
    }
}

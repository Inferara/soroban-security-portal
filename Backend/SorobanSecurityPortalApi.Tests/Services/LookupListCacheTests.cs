using AutoMapper;
using Microsoft.Extensions.Caching.Memory;
using SorobanSecurityPortalApi.Common.Caching;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;
using SorobanSecurityPortalApi.Services.ControllersServices;
using Xunit;

namespace SorobanSecurityPortalApi.Tests.Services
{
    public class LookupListCacheTests
    {
        [Fact]
        public async Task CategoryList_IsCached_AndInvalidatedOnAdd()
        {
            var proc = new Mock<ICategoryProcessor>();
            proc.Setup(p => p.List()).ReturnsAsync(new List<CategoryModel>());
            proc.Setup(p => p.Add(It.IsAny<CategoryModel>())).ReturnsAsync(new CategoryModel { Id = 1 });
            var mapper = new Mock<IMapper>();
            mapper.Setup(m => m.Map<List<CategoryViewModel>>(It.IsAny<object>())).Returns(new List<CategoryViewModel>());
            mapper.Setup(m => m.Map<CategoryModel>(It.IsAny<object>())).Returns(new CategoryModel());
            mapper.Setup(m => m.Map<CategoryViewModel>(It.IsAny<object>())).Returns(new CategoryViewModel());
            var svc = NewCategoryService(mapper.Object, proc.Object);

            await svc.List();
            await svc.List();
            proc.Verify(p => p.List(), Times.Once);

            try { await svc.Add(new CategoryViewModel()); } catch { /* user-context may be unavailable in unit test; Remove runs first */ }
            await svc.List();
            proc.Verify(p => p.List(), Times.Exactly(2));
        }

        private static CategoryService NewCategoryService(IMapper mapper, ICategoryProcessor proc)
        {
            // Build with the real ctor order; ILookupCache is the LAST param.
            var userCtx = new SorobanSecurityPortalApi.Common.UserContextAccessor(
                Mock.Of<Microsoft.AspNetCore.Http.IHttpContextAccessor>(),
                Mock.Of<ILoginProcessor>());
            return new CategoryService(mapper, proc, userCtx,
                new LookupCache(new MemoryCache(new MemoryCacheOptions())));
        }
    }
}

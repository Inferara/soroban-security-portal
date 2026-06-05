using AutoMapper;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Caching.Memory;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Common.Caching;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;
using SorobanSecurityPortalApi.Services.ControllersServices;
using Xunit;

namespace SorobanSecurityPortalApi.Tests.Services
{
    public class CompanyAuditorCacheTests
    {
        private static UserContextAccessor UserCtx() =>
            new(Mock.Of<IHttpContextAccessor>(), Mock.Of<ILoginProcessor>());

        [Fact]
        public async Task CompanyList_NullsImage_AndCaches()
        {
            var proc = new Mock<ICompanyProcessor>();
            proc.Setup(p => p.List()).ReturnsAsync(new List<CompanyModel>());
            var mapper = new Mock<IMapper>();
            mapper.Setup(m => m.Map<List<CompanyViewModel>>(It.IsAny<object>()))
                  .Returns(() => new List<CompanyViewModel> { new() { Id = 1, Name = "C", ImageData = new byte[] { 9 } } });
            var svc = new CompanyService(mapper.Object, proc.Object, UserCtx(),
                                         new LookupCache(new MemoryCache(new MemoryCacheOptions())));

            var r1 = await svc.List();
            await svc.List();

            r1[0].ImageData.Should().BeNull();
            proc.Verify(p => p.List(), Times.Once);
        }

        [Fact]
        public async Task AuditorList_NullsImage_AndCaches()
        {
            var proc = new Mock<IAuditorProcessor>();
            proc.Setup(p => p.List()).ReturnsAsync(new List<AuditorModel>());
            var mapper = new Mock<IMapper>();
            mapper.Setup(m => m.Map<List<AuditorViewModel>>(It.IsAny<object>()))
                  .Returns(() => new List<AuditorViewModel> { new() { Id = 1, Name = "A", ImageData = new byte[] { 9 } } });
            var svc = new AuditorService(mapper.Object, proc.Object, UserCtx(),
                                         new LookupCache(new MemoryCache(new MemoryCacheOptions())));

            var r1 = await svc.List();
            await svc.List();

            r1[0].ImageData.Should().BeNull();
            proc.Verify(p => p.List(), Times.Once);
        }
    }
}

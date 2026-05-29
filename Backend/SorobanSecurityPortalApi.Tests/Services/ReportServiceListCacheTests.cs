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
    public class ReportServiceListCacheTests
    {
        private static (ReportService svc, Mock<IReportProcessor> proc) Build()
        {
            var proc = new Mock<IReportProcessor>();
            proc.Setup(p => p.GetList(false)).ReturnsAsync(new List<ReportModel>());
            proc.Setup(p => p.GetList(true)).ReturnsAsync(new List<ReportModel>());

            var mapper = new Mock<IMapper>();
            mapper.Setup(m => m.Map<List<ReportViewModel>>(It.IsAny<object>()))
                  .Returns(() => new List<ReportViewModel>());

            var userCtx = new UserContextAccessor(
                Mock.Of<IHttpContextAccessor>(),
                Mock.Of<ILoginProcessor>());

            var svc = new ReportService(
                mapper.Object,
                proc.Object,
                userCtx,
                Mock.Of<IGeminiEmbeddingService>(),
                new LookupCache(new MemoryCache(new MemoryCacheOptions())));

            return (svc, proc);
        }

        [Fact]
        public async Task GetList_PublicList_IsCached()
        {
            var (svc, proc) = Build();

            await svc.GetList(false);
            await svc.GetList(false);

            proc.Verify(p => p.GetList(false), Times.Once);
        }

        [Fact]
        public async Task GetList_AdminList_IsNotCached_AndDoesNotPoisonPublicCache()
        {
            var (svc, proc) = Build();

            // Populate the public cache first.
            await svc.GetList(false);

            // The admin (include-everything) variant must hit the processor every time
            // and must never be served from — nor poison — the public cache.
            await svc.GetList(true);
            await svc.GetList(true);

            proc.Verify(p => p.GetList(true), Times.Exactly(2));
            proc.Verify(p => p.GetList(false), Times.Once);
        }
    }
}

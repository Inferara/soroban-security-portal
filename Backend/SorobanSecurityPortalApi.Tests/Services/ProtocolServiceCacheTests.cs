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
    public class ProtocolServiceCacheTests
    {
        private static UserContextAccessor UserCtx() =>
            new(Mock.Of<IHttpContextAccessor>(), Mock.Of<ILoginProcessor>());

        private static (ProtocolService svc, Mock<IProtocolProcessor> proc) Build()
        {
            var proc = new Mock<IProtocolProcessor>();
            var mapper = new Mock<IMapper>();
            mapper.Setup(m => m.Map<List<ProtocolViewModel>>(It.IsAny<object>()))
                  .Returns(() => new List<ProtocolViewModel>
                  {
                      new ProtocolViewModel { Id = 1, Name = "P", ImageData = new byte[] { 1, 2, 3 } }
                  });
            mapper.Setup(m => m.Map<ProtocolModel>(It.IsAny<object>())).Returns(new ProtocolModel());
            mapper.Setup(m => m.Map<ProtocolViewModel>(It.IsAny<object>())).Returns(new ProtocolViewModel());
            var cache = new LookupCache(new MemoryCache(new MemoryCacheOptions()));
            var svc = new ProtocolService(mapper.Object, proc.Object, UserCtx(), cache);
            return (svc, proc);
        }

        [Fact]
        public async Task List_NullsImageData()
        {
            var (svc, proc) = Build();
            proc.Setup(p => p.List()).ReturnsAsync(new List<ProtocolModel>());

            var result = await svc.List();

            result.Should().ContainSingle();
            result[0].ImageData.Should().BeNull();
        }

        [Fact]
        public async Task List_IsCached_SecondCallSkipsProcessor()
        {
            var (svc, proc) = Build();
            proc.Setup(p => p.List()).ReturnsAsync(new List<ProtocolModel>());

            await svc.List();
            await svc.List();

            proc.Verify(p => p.List(), Times.Once);
        }

        // Add calls _userContextAccessor.GetLoginIdAsync() which throws when HttpContext is null.
        // We verify cache invalidation by injecting Mock<ILookupCache> and asserting Remove is called.
        [Fact]
        public async Task Add_InvalidatesCache()
        {
            var proc = new Mock<IProtocolProcessor>();
            var mapper = new Mock<IMapper>();
            mapper.Setup(m => m.Map<ProtocolModel>(It.IsAny<object>())).Returns(new ProtocolModel());
            mapper.Setup(m => m.Map<ProtocolViewModel>(It.IsAny<object>())).Returns(new ProtocolViewModel());
            proc.Setup(p => p.Add(It.IsAny<ProtocolModel>())).ReturnsAsync(new ProtocolModel { Id = 9 });

            var mockCache = new Mock<ILookupCache>();
            // GetOrCreateAsync must call the factory so List() works; but for Add we only care about Remove.
            // Set up GetOrCreateAsync to return an empty list (not exercised in this test path).
            mockCache
                .Setup(c => c.GetOrCreateAsync(
                    It.IsAny<string>(),
                    It.IsAny<Func<Task<List<ProtocolViewModel>>>>(),
                    It.IsAny<TimeSpan?>()))
                .ReturnsAsync(new List<ProtocolViewModel>());

            // Use a real UserContextAccessor with null HttpContext — GetLoginIdAsync returns without
            // setting _loginId (HttpContext == null early-return), then !.Value throws.
            // To keep Add() completable in a unit test we supply a UserContextAccessor whose
            // HttpContext accessor always returns null — the method returns early leaving _loginId null
            // and then throws on Value. We therefore only verify Remove() was called BEFORE the throw.
            var svc = new ProtocolService(mapper.Object, proc.Object, UserCtx(), mockCache.Object);

            // Add will throw after Remove (null loginId), so we swallow InvalidOperationException.
            try { await svc.Add(new ProtocolViewModel { Name = "x" }); } catch (InvalidOperationException) { }

            mockCache.Verify(c => c.Remove(LookupCacheKeys.Protocols), Times.Once);
        }
    }
}

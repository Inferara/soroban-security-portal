using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using FluentAssertions;
using Moq;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;
using SorobanSecurityPortalApi.Services.ControllersServices;
using Xunit;

namespace SorobanSecurityPortalApi.Tests.Services
{
    public class UserServiceTests
    {
        private static UserService BuildService(Mock<ILoginProcessor> processorMock)
        {
            var mapperMock = new Mock<AutoMapper.IMapper>();
            // ExtendedConfig is not used by SearchUsers — pass null (cast to suppress nullable warning).
            return new UserService(mapperMock.Object, processorMock.Object, null!, new SorobanSecurityPortalApi.Services.PublicApi.ApiKeyLookupCache());
        }

        [Fact]
        public async Task Disabling_A_User_Clears_The_Api_Key_Cache_But_Enabling_Does_Not()
        {
            var cache = new SorobanSecurityPortalApi.Services.PublicApi.ApiKeyLookupCache();
            var processor = new Mock<ILoginProcessor>();
            processor.Setup(p => p.GetById(5)).ReturnsAsync(new LoginModel { LoginId = 5, IsEnabled = true });
            var service = new UserService(new Mock<AutoMapper.IMapper>().Object, processor.Object, null!, cache);
            var loads = 0;
            Task<SorobanSecurityPortalApi.Models.DbModels.ApiKeyModel?> Load() { loads++; return Task.FromResult<SorobanSecurityPortalApi.Models.DbModels.ApiKeyModel?>(new() { Id = 1, LoginId = 5 }); }
            await cache.GetAsync("h", Load);

            await service.EnabledChange(5, true);
            await cache.GetAsync("h", Load);
            loads.Should().Be(1); // enabling leaves the cache alone

            await service.EnabledChange(5, false);
            await cache.GetAsync("h", Load);
            loads.Should().Be(2); // disabling dropped it
        }

        [Fact]
        public async Task Deleting_A_User_Clears_The_Api_Key_Cache()
        {
            var cache = new SorobanSecurityPortalApi.Services.PublicApi.ApiKeyLookupCache();
            var processor = new Mock<ILoginProcessor>();
            processor.Setup(p => p.GetById(5)).ReturnsAsync(new LoginModel { LoginId = 5 });
            var service = new UserService(new Mock<AutoMapper.IMapper>().Object, processor.Object, null!, cache);
            var loads = 0;
            Task<SorobanSecurityPortalApi.Models.DbModels.ApiKeyModel?> Load() { loads++; return Task.FromResult<SorobanSecurityPortalApi.Models.DbModels.ApiKeyModel?>(new() { Id = 1, LoginId = 5 }); }
            await cache.GetAsync("h", Load);

            await service.Delete(5);
            await cache.GetAsync("h", Load);

            loads.Should().Be(2);
        }

        [Fact]
        public async Task SearchUsers_Maps_DisplayName_Prefers_FullName_Over_Login()
        {
            var processor = new Mock<ILoginProcessor>();
            processor.Setup(p => p.SearchUsers("ali", 5))
                .ReturnsAsync(new List<LoginModel>
                {
                    new() { LoginId = 1, Login = "alice", FullName = "Alice Adams" },
                    new() { LoginId = 2, Login = "alison", FullName = "" }, // empty FullName → fall back to Login
                });

            var service = BuildService(processor);
            var results = await service.SearchUsers("ali");

            results.Should().HaveCount(2);

            var first = results.First(r => r.Id == 1);
            first.Username.Should().Be("alice");
            first.DisplayName.Should().Be("Alice Adams");

            var second = results.First(r => r.Id == 2);
            second.Username.Should().Be("alison");
            second.DisplayName.Should().Be("alison"); // fell back to Login
        }

        [Fact]
        public async Task SearchUsers_Passes_Limit_5_To_Processor()
        {
            var processor = new Mock<ILoginProcessor>();
            processor.Setup(p => p.SearchUsers(It.IsAny<string>(), It.IsAny<int>()))
                .ReturnsAsync(new List<LoginModel>());

            var service = BuildService(processor);
            await service.SearchUsers("bob");

            processor.Verify(p => p.SearchUsers("bob", 5), Times.Once);
        }
    }
}

using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.AspNetCore.SignalR;
using Moq;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Hubs;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;
using SorobanSecurityPortalApi.Services.Realtime;
using Xunit;

namespace SorobanSecurityPortalApi.Tests.Services
{
    public class RealtimePublisherTests
    {
        [Fact]
        public async Task NotifyUserAsync_Resolves_Login_And_Sends_To_That_User()
        {
            var clientProxy = new Mock<IClientProxy>();
            var clients = new Mock<IHubClients>();
            clients.Setup(c => c.User("alice")).Returns(clientProxy.Object);
            var hub = new Mock<IHubContext<NotificationHub>>();
            hub.Setup(h => h.Clients).Returns(clients.Object);

            var login = new Mock<ILoginProcessor>();
            login.Setup(l => l.GetById(5)).ReturnsAsync(new LoginModel { LoginId = 5, Login = "alice" });

            var dto = new NotificationViewModel { Id = 1, CommentId = 9 };
            await new SignalRNotificationPublisher(hub.Object, login.Object).NotifyUserAsync(5, dto);

            clients.Verify(c => c.User("alice"), Times.Once);
            clientProxy.Verify(p => p.SendCoreAsync(
                SignalRNotificationPublisher.ReceiveNotificationMethod,
                It.Is<object[]>(a => a.Length == 1 && a[0] == dto),
                It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task NotifyUserAsync_NoOp_When_User_Missing()
        {
            var clients = new Mock<IHubClients>();
            var hub = new Mock<IHubContext<NotificationHub>>();
            hub.Setup(h => h.Clients).Returns(clients.Object);
            var login = new Mock<ILoginProcessor>();
            login.Setup(l => l.GetById(It.IsAny<int>())).ReturnsAsync((LoginModel?)null);

            await new SignalRNotificationPublisher(hub.Object, login.Object).NotifyUserAsync(999, new NotificationViewModel());

            clients.Verify(c => c.User(It.IsAny<string>()), Times.Never);
        }
    }
}

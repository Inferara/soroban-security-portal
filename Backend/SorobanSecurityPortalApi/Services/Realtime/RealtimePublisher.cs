using Microsoft.AspNetCore.SignalR;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Hubs;
using SorobanSecurityPortalApi.Models.ViewModels;

namespace SorobanSecurityPortalApi.Services.Realtime
{
    public interface IRealtimePublisher
    {
        Task NotifyUserAsync(int recipientUserId, NotificationViewModel notification);
    }

    public class SignalRNotificationPublisher : IRealtimePublisher
    {
        public const string ReceiveNotificationMethod = "ReceiveNotification";

        private readonly IHubContext<NotificationHub> _hub;
        private readonly ILoginProcessor _loginProcessor;

        public SignalRNotificationPublisher(IHubContext<NotificationHub> hub, ILoginProcessor loginProcessor)
        {
            _hub = hub;
            _loginProcessor = loginProcessor;
        }

        public async Task NotifyUserAsync(int recipientUserId, NotificationViewModel notification)
        {
            // SignalR keys connections by login name (NameIdentifier claim); map id -> name.
            var login = await _loginProcessor.GetById(recipientUserId);
            if (login == null) return;
            await _hub.Clients.User(login.Login).SendAsync(ReceiveNotificationMethod, notification);
        }
    }
}

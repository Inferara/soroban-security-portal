using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace SorobanSecurityPortalApi.Hubs
{
    // Clients connect and receive server-pushed "ReceiveNotification" events; no client->server methods.
    // SignalR's default IUserIdProvider keys connections by the NameIdentifier claim (= login name),
    // which is what SignalRNotificationPublisher targets via Clients.User(name).
    [Authorize]
    public class NotificationHub : Hub
    {
    }
}

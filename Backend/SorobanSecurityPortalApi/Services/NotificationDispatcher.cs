using Microsoft.AspNetCore.SignalR;
using SorobanSecurityPortalApi.Hubs;

namespace SorobanSecurityPortalApi.Services;

public class NotificationDispatcher : INotificationDispatcher
{
    private readonly IHubContext<NotificationHub> _hubContext;

    public NotificationDispatcher(IHubContext<NotificationHub> hubContext)
    {
        _hubContext = hubContext;
    }

    public async Task SendToUserAsync(string userId, string method, object arg1, CancellationToken cancellationToken = default)
    {
        await _hubContext.Clients.User(userId).SendAsync(method, arg1, cancellationToken);
    }

    public async Task SendToAllAsync(string method, object arg1, CancellationToken cancellationToken = default)
    {
        await _hubContext.Clients.All.SendAsync(method, arg1, cancellationToken);
    }
}

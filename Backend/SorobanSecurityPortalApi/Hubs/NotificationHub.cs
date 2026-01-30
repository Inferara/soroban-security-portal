using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using StackExchange.Redis;

namespace SorobanSecurityPortalApi.Hubs;

[Authorize]
public class NotificationHub : Hub
{
    private readonly IConnectionMultiplexer _redis;
    private readonly ILogger<NotificationHub> _logger;

    public NotificationHub(IConnectionMultiplexer redis, ILogger<NotificationHub> logger)
    {
        _redis = redis;
        _logger = logger;
    }

    public override async Task OnConnectedAsync()
    {
        var userId = Context.UserIdentifier;
        if (!string.IsNullOrEmpty(userId))
        {
            try
            {
                var db = _redis.GetDatabase();
                await db.SetAddAsync($"user:{userId}:connections", Context.ConnectionId);
                _logger.LogInformation("User {UserId} connected with connection ID {ConnectionId}", userId, Context.ConnectionId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error tracking connection for user {UserId}", userId);
            }
        }
        
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var userId = Context.UserIdentifier;
        if (!string.IsNullOrEmpty(userId))
        {
            try
            {
                var db = _redis.GetDatabase();
                await db.SetRemoveAsync($"user:{userId}:connections", Context.ConnectionId);
                _logger.LogInformation("User {UserId} disconnected (Connection ID: {ConnectionId})", userId, Context.ConnectionId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error removing connection tracking for user {UserId}", userId);
            }
        }

        await base.OnDisconnectedAsync(exception);
    }
}

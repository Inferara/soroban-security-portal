namespace SorobanSecurityPortalApi.Services;

public interface INotificationDispatcher
{
    Task SendToUserAsync(string userId, string method, object arg1, CancellationToken cancellationToken = default);
    Task SendToAllAsync(string method, object arg1, CancellationToken cancellationToken = default);
}

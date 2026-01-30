using SorobanSecurityPortalApi.Models.ViewModels;

namespace SorobanSecurityPortalApi.Services.ControllersServices
{
    public interface INotificationService
    {
        Task SendNotification(int userId, string message, string link, string type, int? threadId = null);
        Task<List<NotificationViewModel>> GetNotifications(int userId);
        Task MarkAsRead(int notificationId);
        Task MarkAllAsRead(int userId);
    }
}

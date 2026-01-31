using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;

namespace SorobanSecurityPortalApi.Services.ControllersServices
{
    public class NotificationService : INotificationService
    {
        private readonly INotificationProcessor _notificationProcessor;

        public NotificationService(INotificationProcessor notificationProcessor)
        {
            _notificationProcessor = notificationProcessor;
        }

        public async Task<List<NotificationModel>> GetNotificationsForUser(int userId, bool onlyUnread = false)
        {
            return await _notificationProcessor.GetNotificationsForUser(userId, onlyUnread);
        }

        public async Task<NotificationModel?> GetNotificationById(int notificationId)
        {
            return await _notificationProcessor.GetNotificationById(notificationId);
        }

        public async Task MarkAsRead(int notificationId, int userId)
        {
            await _notificationProcessor.MarkAsRead(notificationId, userId);
        }

        public async Task MarkAllAsRead(int userId)
        {
            await _notificationProcessor.MarkAllAsRead(userId);
        }

        public async Task DeleteNotification(int notificationId, int userId)
        {
            await _notificationProcessor.DeleteNotification(notificationId, userId);
        }

        public async Task<int> GetUnreadCount(int userId)
        {
            return await _notificationProcessor.GetUnreadCount(userId);
        }
    }

    public interface INotificationService
    {
        Task<List<NotificationModel>> GetNotificationsForUser(int userId, bool onlyUnread = false);
        Task<NotificationModel?> GetNotificationById(int notificationId);
        Task MarkAsRead(int notificationId, int userId);
        Task MarkAllAsRead(int userId);
        Task DeleteNotification(int notificationId, int userId);
        Task<int> GetUnreadCount(int userId);
    }
}
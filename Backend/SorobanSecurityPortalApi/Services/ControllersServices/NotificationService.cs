using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;
using Microsoft.EntityFrameworkCore;

namespace SorobanSecurityPortalApi.Services.ControllersServices
{
    public class NotificationService : INotificationService
    {
        private readonly Db _db;

        public NotificationService(Db db)
        {
            _db = db;
        }

        public async Task SendNotification(int userId, string message, string link, string type, int? threadId = null)
        {
            var notification = new NotificationModel
            {
                UserId = userId,
                Message = message,
                Link = link,
                Type = type,
                ThreadId = threadId,
                IsRead = false,
                CreatedAt = DateTime.UtcNow
            };

            _db.Notification.Add(notification);
            await _db.SaveChangesAsync();
        }

        public async Task<List<NotificationViewModel>> GetNotifications(int userId)
        {
            return await _db.Notification
                .Where(n => n.UserId == userId)
                .OrderByDescending(n => n.CreatedAt)
                .Select(n => new NotificationViewModel
                {
                    Id = n.Id,
                    Message = n.Message,
                    Link = n.Link,
                    Type = n.Type,
                    ThreadId = n.ThreadId,
                    IsRead = n.IsRead,
                    CreatedAt = n.CreatedAt
                })
                .ToListAsync();
        }

        public async Task MarkAsRead(int notificationId)
        {
            var notification = await _db.Notification.FindAsync(notificationId);
            if (notification != null)
            {
                notification.IsRead = true;
                await _db.SaveChangesAsync();
            }
        }

        public async Task MarkAllAsRead(int userId)
        {
            var notifications = await _db.Notification.Where(n => n.UserId == userId && !n.IsRead).ToListAsync();
            foreach (var notification in notifications)
            {
                notification.IsRead = true;
            }
            await _db.SaveChangesAsync();
        }
    }
}

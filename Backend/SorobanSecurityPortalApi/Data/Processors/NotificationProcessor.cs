using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Models.DbModels;
using Microsoft.EntityFrameworkCore;

namespace SorobanSecurityPortalApi.Data.Processors
{
    public class NotificationProcessor : INotificationProcessor
    {
        private readonly IDbContextFactory<Db> _dbFactory;

        public NotificationProcessor(IDbContextFactory<Db> dbFactory)
        {
            _dbFactory = dbFactory;
        }

        public async Task<List<NotificationModel>> GetNotificationsForUser(int userId, bool onlyUnread = false)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var query = db.Notification.AsNoTracking()
                .Include(n => n.Sender)
                .Include(n => n.Recipient)
                .Where(n => n.RecipientUserId == userId);

            if (onlyUnread)
            {
                query = query.Where(n => !n.IsRead);
            }

            return await query.OrderByDescending(n => n.CreatedAt).ToListAsync();
        }

        public async Task<NotificationModel?> GetNotificationById(int notificationId)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            return await db.Notification.AsNoTracking()
                .Include(n => n.Sender)
                .Include(n => n.Recipient)
                .FirstOrDefaultAsync(n => n.Id == notificationId);
        }

        public async Task CreateNotifications(List<NotificationModel> notifications)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            await db.Notification.AddRangeAsync(notifications);
            await db.SaveChangesAsync();
        }

        public async Task MarkAsRead(int notificationId, int userId)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var notification = await db.Notification
                .FirstOrDefaultAsync(n => n.Id == notificationId && n.RecipientUserId == userId);

            if (notification != null)
            {
                notification.IsRead = true;
                await db.SaveChangesAsync();
            }
        }

        public async Task MarkAllAsRead(int userId)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var notifications = await db.Notification
                .Where(n => n.RecipientUserId == userId && !n.IsRead)
                .ToListAsync();

            foreach (var notification in notifications)
            {
                notification.IsRead = true;
            }

            await db.SaveChangesAsync();
        }

        public async Task DeleteNotification(int notificationId, int userId)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var notification = await db.Notification
                .FirstOrDefaultAsync(n => n.Id == notificationId && n.RecipientUserId == userId);

            if (notification != null)
            {
                db.Notification.Remove(notification);
                await db.SaveChangesAsync();
            }
        }

        public async Task<int> GetUnreadCount(int userId)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            return await db.Notification
                .Where(n => n.RecipientUserId == userId && !n.IsRead)
                .CountAsync();
        }
    }

    public interface INotificationProcessor
    {
        Task<List<NotificationModel>> GetNotificationsForUser(int userId, bool onlyUnread = false);
        Task<NotificationModel?> GetNotificationById(int notificationId);
        Task CreateNotifications(List<NotificationModel> notifications);
        Task MarkAsRead(int notificationId, int userId);
        Task MarkAllAsRead(int userId);
        Task DeleteNotification(int notificationId, int userId);
        Task<int> GetUnreadCount(int userId);
    }
}
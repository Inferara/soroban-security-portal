using Microsoft.EntityFrameworkCore;
using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Models.DbModels;

namespace SorobanSecurityPortalApi.Data.Processors
{
    public class NotificationProcessor : INotificationProcessor
    {
        private readonly IDbContextFactory<Db> _dbFactory;
        public NotificationProcessor(IDbContextFactory<Db> dbFactory) => _dbFactory = dbFactory;

        public async Task AddRange(IEnumerable<NotificationModel> notifications)
        {
            var list = notifications.ToList();
            if (list.Count == 0) return;
            await using var db = await _dbFactory.CreateDbContextAsync();
            db.Notification.AddRange(list);
            await db.SaveChangesAsync();
        }

        public async Task<List<NotificationModel>> ListForUser(int userId, NotificationType? type, int page, int pageSize)
        {
            page = Math.Max(1, page);
            pageSize = Math.Max(1, Math.Min(100, pageSize));
            await using var db = await _dbFactory.CreateDbContextAsync();
            var q = db.Notification.AsNoTracking().Where(n => n.RecipientUserId == userId);
            if (type.HasValue) q = q.Where(n => n.Type == type.Value);
            return await q.OrderByDescending(n => n.CreatedAt).ThenByDescending(n => n.Id)
                .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
        }

        public async Task<int> UnreadCount(int userId)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            return await db.Notification.AsNoTracking().CountAsync(n => n.RecipientUserId == userId && !n.IsRead);
        }

        public async Task MarkRead(int id, int userId)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var n = await db.Notification.FirstOrDefaultAsync(x => x.Id == id && x.RecipientUserId == userId);
            if (n == null || n.IsRead) return;
            n.IsRead = true;
            await db.SaveChangesAsync();
        }

        public async Task MarkAllRead(int userId)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var unread = await db.Notification.Where(n => n.RecipientUserId == userId && !n.IsRead).ToListAsync();
            foreach (var n in unread) n.IsRead = true;
            if (unread.Count > 0) await db.SaveChangesAsync();
        }
    }

    public interface INotificationProcessor
    {
        Task AddRange(IEnumerable<NotificationModel> notifications);
        Task<List<NotificationModel>> ListForUser(int userId, NotificationType? type, int page, int pageSize);
        Task<int> UnreadCount(int userId);
        Task MarkRead(int id, int userId);
        Task MarkAllRead(int userId);
    }
}

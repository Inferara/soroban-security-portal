using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;
using Microsoft.EntityFrameworkCore;

namespace SorobanSecurityPortalApi.Services.ControllersServices
{
    public class ThreadService : IThreadService
    {
        private readonly Db _db;
        private readonly INotificationService _notificationService;

        public ThreadService(Db db, INotificationService notificationService)
        {
            _db = db;
            _notificationService = notificationService;
        }

        public async Task<ThreadViewModel?> GetThreadByVulnerabilityId(int vulnerabilityId, int userId)
        {
            var thread = await _db.Thread
                .Include(t => t.Replies)
                .FirstOrDefaultAsync(t => t.VulnerabilityId == vulnerabilityId);

            if (thread == null) return null;

            var userNames = await _db.Login.ToDictionaryAsync(l => l.LoginId, l => l.FullName);

            var isWatching = await _db.ThreadSubscription
                .AnyAsync(s => s.ThreadId == thread.Id && s.UserId == userId && s.IsWatching);

            return new ThreadViewModel
            {
                Id = thread.Id,
                VulnerabilityId = thread.VulnerabilityId,
                CreatedAt = thread.CreatedAt,
                CreatedBy = thread.CreatedBy,
                IsUserWatching = isWatching,
                Replies = thread.Replies
                    .OrderBy(r => r.CreatedAt)
                    .Select(r => new ThreadReplyViewModel
                    {
                        Id = r.Id,
                        Content = r.Content,
                        CreatedBy = r.CreatedBy,
                        CreatedByName = userNames.TryGetValue(r.CreatedBy, out var name) ? name : "Unknown",
                        CreatedAt = r.CreatedAt
                    }).ToList()
            };
        }

        public async Task<int> AddReply(int threadId, int userId, string content)
        {
            var reply = new ThreadReplyModel
            {
                ThreadId = threadId,
                CreatedBy = userId,
                Content = content,
                CreatedAt = DateTime.UtcNow
            };

            _db.ThreadReply.Add(reply);

            // Auto-watch on reply
            await EnsureSubscription(threadId, userId, true);

            await _db.SaveChangesAsync();

            // Notify watchers
            var thread = await _db.Thread.Include(t => t.Vulnerability).FirstAsync(t => t.Id == threadId);
            var watchers = await _db.ThreadSubscription
                .Where(s => s.ThreadId == threadId && s.UserId != userId && s.IsWatching)
                .Select(s => s.UserId)
                .ToListAsync();

            var message = $"New reply to thread for vulnerability: {thread.Vulnerability?.Title}";
            var link = $"/vulnerability/{thread.VulnerabilityId}";

            foreach (var watcherId in watchers)
            {
                await _notificationService.SendNotification(watcherId, message, link, "Reply", threadId);
            }

            return reply.Id;
        }

        public async Task ToggleWatch(int threadId, int userId, bool isWatching)
        {
            await EnsureSubscription(threadId, userId, isWatching);
            await _db.SaveChangesAsync();
        }

        public async Task<List<ThreadViewModel>> GetWatchedThreads(int userId)
        {
            var watchedThreads = await _db.ThreadSubscription
                .Where(s => s.UserId == userId && s.IsWatching)
                .Select(s => s.ThreadId)
                .ToListAsync();

            var result = new List<ThreadViewModel>();
            foreach (var threadId in watchedThreads)
            {
                var thread = await _db.Thread.FindAsync(threadId);
                if (thread != null)
                {
                    var vm = await GetThreadByVulnerabilityId(thread.VulnerabilityId, userId);
                    if (vm != null) result.Add(vm);
                }
            }
            return result;
        }

        public async Task EnsureThreadExists(int vulnerabilityId, int userId)
        {
            var exists = await _db.Thread.AnyAsync(t => t.VulnerabilityId == vulnerabilityId);
            if (!exists)
            {
                var thread = new ThreadModel
                {
                    VulnerabilityId = vulnerabilityId,
                    CreatedAt = DateTime.UtcNow,
                    CreatedBy = userId
                };
                _db.Thread.Add(thread);
                await _db.SaveChangesAsync();

                // Auto-watch for creator
                await EnsureSubscription(thread.Id, userId, true);
                await _db.SaveChangesAsync();
            }
        }

        private async Task EnsureSubscription(int threadId, int userId, bool isWatching)
        {
            var sub = await _db.ThreadSubscription
                .FirstOrDefaultAsync(s => s.ThreadId == threadId && s.UserId == userId);

            if (sub == null)
            {
                sub = new ThreadSubscriptionModel
                {
                    ThreadId = threadId,
                    UserId = userId,
                    IsWatching = isWatching,
                    CreatedAt = DateTime.UtcNow
                };
                _db.ThreadSubscription.Add(sub);
            }
            else
            {
                sub.IsWatching = isWatching;
            }
        }
    }
}

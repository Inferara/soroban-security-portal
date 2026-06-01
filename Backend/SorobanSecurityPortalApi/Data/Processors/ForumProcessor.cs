using Microsoft.EntityFrameworkCore;
using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Models.DbModels;

namespace SorobanSecurityPortalApi.Data.Processors
{
    public class ForumProcessor : IForumProcessor
    {
        private readonly IDbContextFactory<Db> _dbFactory;

        public ForumProcessor(IDbContextFactory<Db> dbFactory)
        {
            _dbFactory = dbFactory;
        }

        public async Task<List<ForumCategoryModel>> GetCategories()
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            return await db.ForumCategory.AsNoTracking()
                .OrderBy(c => c.SortOrder)
                .ToListAsync();
        }

        public async Task<ForumCategoryModel?> GetCategoryBySlug(string slug)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            return await db.ForumCategory.AsNoTracking()
                .FirstOrDefaultAsync(c => c.Slug == slug);
        }

        public async Task<ForumCategoryModel?> GetCategoryById(int id)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            return await db.ForumCategory.AsNoTracking()
                .FirstOrDefaultAsync(c => c.Id == id);
        }

        public async Task<int> GetThreadCountForCategory(int categoryId)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            return await db.ForumThread.AsNoTracking()
                .CountAsync(t => t.CategoryId == categoryId);
        }

        public async Task<List<ForumThreadModel>> GetThreadsByCategory(int categoryId, int page, int pageSize)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            return await db.ForumThread.AsNoTracking()
                .Where(t => t.CategoryId == categoryId)
                .OrderByDescending(t => t.IsPinned)
                .ThenByDescending(t => t.UpdatedAt ?? t.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();
        }

        public async Task<ForumThreadModel?> GetThreadBySlug(string slug)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            return await db.ForumThread.AsNoTracking()
                .FirstOrDefaultAsync(t => t.Slug == slug);
        }

        public async Task<ForumThreadModel?> GetThreadById(int id)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            return await db.ForumThread.AsNoTracking()
                .FirstOrDefaultAsync(t => t.Id == id);
        }

        public async Task<int> GetPostCountForThread(int threadId)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            return await db.ForumPost.AsNoTracking()
                .CountAsync(p => p.ThreadId == threadId);
        }

        public async Task<List<ForumPostModel>> GetPostsByThread(int threadId, int page, int pageSize)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            return await db.ForumPost.AsNoTracking()
                .Where(p => p.ThreadId == threadId)
                .OrderBy(p => p.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();
        }

        public async Task<ForumPostModel?> GetPostById(int id)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            return await db.ForumPost.AsNoTracking()
                .FirstOrDefaultAsync(p => p.Id == id);
        }

        public async Task<ForumThreadModel> CreateThread(ForumThreadModel thread)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            db.ForumThread.Add(thread);
            await db.SaveChangesAsync();
            return thread;
        }

        public async Task<ForumPostModel> CreatePost(ForumPostModel post)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            db.ForumPost.Add(post);
            
            // Update thread's UpdatedAt timestamp
            var thread = await db.ForumThread.FirstOrDefaultAsync(t => t.Id == post.ThreadId);
            if (thread != null)
            {
                thread.UpdatedAt = DateTime.UtcNow;
            }
            
            await db.SaveChangesAsync();
            return post;
        }

        public async Task<ForumPostModel?> UpdatePost(int id, string content, string contentHtml)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var post = await db.ForumPost.FirstOrDefaultAsync(p => p.Id == id);
            if (post == null) return null;
            
            post.Content = content;
            post.ContentHtml = contentHtml;
            post.IsEdited = true;
            post.UpdatedAt = DateTime.UtcNow;
            
            // Update thread's UpdatedAt timestamp
            var thread = await db.ForumThread.FirstOrDefaultAsync(t => t.Id == post.ThreadId);
            if (thread != null)
            {
                thread.UpdatedAt = DateTime.UtcNow;
            }
            
            await db.SaveChangesAsync();
            return post;
        }

        public async Task IncrementViewCount(int threadId)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var thread = await db.ForumThread.FirstOrDefaultAsync(t => t.Id == threadId);
            if (thread != null)
            {
                thread.ViewCount++;
                await db.SaveChangesAsync();
            }
        }

        public async Task<ForumPostModel?> UpdatePostVotes(int postId, int voteDelta)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var post = await db.ForumPost.FirstOrDefaultAsync(p => p.Id == postId);
            if (post == null) return null;
            
            post.Votes += voteDelta;
            await db.SaveChangesAsync();
            return post;
        }

        public async Task<Dictionary<int, string>> GetAuthorNames(List<int> userIds)
        {
            if (userIds == null || userIds.Count == 0) return new Dictionary<int, string>();
            await using var db = await _dbFactory.CreateDbContextAsync();
            var rows = await db.Login.AsNoTracking()
                .Where(l => userIds.Contains(l.LoginId))
                .Select(l => new { l.LoginId, l.FullName, l.Login })
                .ToListAsync();
            return rows.ToDictionary(
                r => r.LoginId,
                r => !string.IsNullOrWhiteSpace(r.FullName) ? r.FullName : r.Login);
        }

        public async Task<ForumPostModel?> GetLastPostForThread(int threadId)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            return await db.ForumPost.AsNoTracking()
                .Where(p => p.ThreadId == threadId)
                .OrderByDescending(p => p.CreatedAt)
                .FirstOrDefaultAsync();
        }
    }

    public interface IForumProcessor
    {
        Task<List<ForumCategoryModel>> GetCategories();
        Task<ForumCategoryModel?> GetCategoryBySlug(string slug);
        Task<ForumCategoryModel?> GetCategoryById(int id);
        Task<int> GetThreadCountForCategory(int categoryId);
        Task<List<ForumThreadModel>> GetThreadsByCategory(int categoryId, int page, int pageSize);
        Task<ForumThreadModel?> GetThreadBySlug(string slug);
        Task<ForumThreadModel?> GetThreadById(int id);
        Task<int> GetPostCountForThread(int threadId);
        Task<List<ForumPostModel>> GetPostsByThread(int threadId, int page, int pageSize);
        Task<ForumPostModel?> GetPostById(int id);
        Task<ForumThreadModel> CreateThread(ForumThreadModel thread);
        Task<ForumPostModel> CreatePost(ForumPostModel post);
        Task<ForumPostModel?> UpdatePost(int id, string content, string contentHtml);
        Task IncrementViewCount(int threadId);
        Task<ForumPostModel?> UpdatePostVotes(int postId, int voteDelta);
        Task<Dictionary<int, string>> GetAuthorNames(List<int> userIds);
        Task<ForumPostModel?> GetLastPostForThread(int threadId);
    }
}

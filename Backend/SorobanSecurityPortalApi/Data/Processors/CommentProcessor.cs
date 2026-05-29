using Microsoft.EntityFrameworkCore;
using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Models.DbModels;

namespace SorobanSecurityPortalApi.Data.Processors
{
    public class CommentProcessor : ICommentProcessor
    {
        private readonly IDbContextFactory<Db> _dbFactory;

        public CommentProcessor(IDbContextFactory<Db> dbFactory)
        {
            _dbFactory = dbFactory;
        }

        public async Task<CommentModel> Add(CommentModel comment)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            db.Comment.Add(comment);
            await db.SaveChangesAsync();
            return comment;
        }

        public async Task<CommentModel?> Get(int id)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            return await db.Comment.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
        }

        public async Task<List<CommentModel>> ListByEntity(
            EntityType entityType, int entityId, int page, int pageSize, bool includeSuppressed)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var query = db.Comment.AsNoTracking()
                .Where(c => c.EntityType == entityType && c.EntityId == entityId)
                .Where(c => c.ParentCommentId == null);
            if (!includeSuppressed)
            {
                query = query.Where(c => !c.IsHidden && !c.IsDeleted);
            }
            return await query
                .OrderBy(c => c.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();
        }

        public async Task SoftDelete(int id)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var comment = await db.Comment.FirstOrDefaultAsync(x => x.Id == id);
            if (comment == null) return;
            comment.IsDeleted = true;
            comment.DeletedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
        }

        public async Task<int> CountByEntity(EntityType entityType, int entityId)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            // Count every visible comment that is reachable from a visible top-level comment
            // through an unbroken chain of visible ancestors (any depth). A comment whose
            // ancestor is hidden/deleted is orphaned — it is not rendered, so it is not counted.
            var rows = await db.Comment.AsNoTracking()
                .Where(c => c.EntityType == entityType && c.EntityId == entityId && !c.IsHidden && !c.IsDeleted)
                .Select(c => new { c.Id, c.ParentCommentId })
                .ToListAsync();

            var childrenByParent = rows
                .Where(r => r.ParentCommentId.HasValue)
                .GroupBy(r => r.ParentCommentId!.Value)
                .ToDictionary(g => g.Key, g => g.Select(x => x.Id).ToList());

            var count = 0;
            var seen = new HashSet<int>();
            var queue = new Queue<int>(rows.Where(r => r.ParentCommentId == null).Select(r => r.Id));
            while (queue.Count > 0)
            {
                var id = queue.Dequeue();
                if (!seen.Add(id)) continue;
                count++;
                if (childrenByParent.TryGetValue(id, out var kids))
                    foreach (var k in kids) queue.Enqueue(k);
            }
            return count;
        }

        public async Task<List<CommentModel>> ListReplies(EntityType entityType, int entityId, List<int> parentIds)
        {
            if (parentIds == null || parentIds.Count == 0) return new List<CommentModel>();
            await using var db = await _dbFactory.CreateDbContextAsync();
            return await db.Comment.AsNoTracking()
                .Where(c => c.EntityType == entityType && c.EntityId == entityId
                            && c.ParentCommentId != null && parentIds.Contains(c.ParentCommentId.Value)
                            && !c.IsHidden && !c.IsDeleted)
                .OrderBy(c => c.CreatedAt)
                .ToListAsync();
        }

        public async Task<bool> EntityExists(EntityType entityType, int entityId)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            return entityType switch
            {
                EntityType.Vulnerability => await db.Vulnerability.AsNoTracking().AnyAsync(v => v.Id == entityId),
                EntityType.Report => await db.Report.AsNoTracking().AnyAsync(r => r.Id == entityId),
                _ => false
            };
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

        public async Task<CommentModel?> UpdateContent(int id, string content, string contentHtml, string editHistoryJson)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var c = await db.Comment.FirstOrDefaultAsync(x => x.Id == id);
            if (c == null) return null;
            c.Content = content;
            c.ContentHtml = contentHtml;
            c.EditHistory = editHistoryJson;
            c.IsEdited = true;
            c.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
            return c;
        }
    }

    public interface ICommentProcessor
    {
        Task<CommentModel> Add(CommentModel comment);
        Task<CommentModel?> Get(int id);
        Task<List<CommentModel>> ListByEntity(EntityType entityType, int entityId, int page, int pageSize, bool includeSuppressed);
        /// <summary>
        /// Soft-deletes a comment (sets IsDeleted + DeletedAt). Idempotent: no-ops if the comment does not exist.
        /// </summary>
        Task SoftDelete(int id);
        Task<int> CountByEntity(EntityType entityType, int entityId);
        Task<List<CommentModel>> ListReplies(EntityType entityType, int entityId, List<int> parentIds);
        Task<bool> EntityExists(EntityType entityType, int entityId);
        Task<Dictionary<int, string>> GetAuthorNames(List<int> userIds);
        Task<CommentModel?> UpdateContent(int id, string content, string contentHtml, string editHistoryJson);
    }
}

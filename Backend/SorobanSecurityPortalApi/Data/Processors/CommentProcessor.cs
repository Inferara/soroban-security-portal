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
    }

    public interface ICommentProcessor
    {
        Task<CommentModel> Add(CommentModel comment);
        Task<CommentModel?> Get(int id);
        Task<List<CommentModel>> ListByEntity(EntityType entityType, int entityId, int page, int pageSize, bool includeSuppressed);
        Task SoftDelete(int id);
    }
}

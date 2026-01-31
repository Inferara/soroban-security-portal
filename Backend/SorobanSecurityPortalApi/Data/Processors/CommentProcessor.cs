using Microsoft.EntityFrameworkCore;
using SorobanSecurityPortalApi.Common.Data; 
using SorobanSecurityPortalApi.Models.DbModels; 
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;


namespace SorobanSecurityPortalApi.Data.Processors
{
    public interface ICommentProcessor
    {
        Task<List<CommentModel>> GetCommentsForEntity(string entityType, int entityId);
        Task<CommentModel?> GetCommentById(int commentId);
        Task<CommentModel> AddComment(CommentModel comment);
        Task<bool> UpdateCommentStatus(int commentId, CommentStatus status);
        Task<bool> SoftDeleteComment(int commentId);
        Task<bool> UpdateVoteCounts(int commentId, int upvoteDelta, int downvoteDelta);
        Task<CommentModel?> GetCommentByIdAdmin(int commentId); 
        Task<bool> RestoreComment(int commentId);
    }

    public class CommentProcessor : ICommentProcessor
    {
        private readonly Db _db;

        public CommentProcessor(Db db)
        {
            _db = db;
        }

        public async Task<List<CommentModel>> GetCommentsForEntity(string entityType, int entityId)
        {
            return await _db.Comments
                .Include(c => c.Author)
                .Include(c => c.Mentions)
                .Where(c => c.EntityType == entityType && c.EntityId == entityId)
                .OrderBy(c => c.CreatedAt)
                .ToListAsync();
        }

        public async Task<CommentModel?> GetCommentById(int commentId)
        {
            return await _db.Comments
                .Include(c => c.Author)
                .Include(c => c.Mentions)
                .FirstOrDefaultAsync(c => c.Id == commentId);
        }

        public async Task<CommentModel> AddComment(CommentModel comment)
        {
            _db.Comments.Add(comment);
            await _db.SaveChangesAsync();
            return comment;
        }

        public async Task<bool> UpdateCommentStatus(int commentId, CommentStatus status)
        {
            var comment = await _db.Comments.FindAsync(commentId);
            if (comment == null) return false;

            comment.Status = status;
            comment.UpdatedAt = DateTime.UtcNow;
            
            return await _db.SaveChangesAsync() > 0;
        }

        public async Task<bool> SoftDeleteComment(int commentId)
        {
            var comment = await _db.Comments.FindAsync(commentId);
            if (comment == null) return false;

            comment.DeletedAt = DateTime.UtcNow;
            comment.Status = CommentStatus.Deleted;
            
            return await _db.SaveChangesAsync() > 0;
        }

        public async Task<bool> UpdateVoteCounts(int commentId, int upvoteDelta, int downvoteDelta)
        {
            var comment = await _db.Comments.FindAsync(commentId);
            if (comment == null) return false;

            comment.UpvoteCount += upvoteDelta;
            comment.DownvoteCount += downvoteDelta;
            
            return await _db.SaveChangesAsync() > 0;
        }

        public async Task<CommentModel?> GetCommentByIdAdmin(int commentId)
        {
            return await _db.Comments
                .IgnoreQueryFilters()
                .Include(c => c.Author)
                .Include(c => c.Mentions)
                .FirstOrDefaultAsync(c => c.Id == commentId);
        }

        public async Task<bool> RestoreComment(int commentId)
        {
            var comment = await _db.Comments
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(c => c.Id == commentId);

            if (comment == null) return false;

            comment.DeletedAt = null;
            comment.Status = CommentStatus.Active; 
            comment.UpdatedAt = DateTime.UtcNow;

            return await _db.SaveChangesAsync() > 0;
        }
    }
}

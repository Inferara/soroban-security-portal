using Microsoft.EntityFrameworkCore;
using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;

namespace SorobanSecurityPortalApi.Data.Processors
{
    public class CommentProcessor : ICommentProcessor
    {
        private readonly IDbContextFactory<Db> _dbFactory;

        public CommentProcessor(IDbContextFactory<Db> dbFactory)
        {
            _dbFactory = dbFactory;
        }

        public async Task<int> Add(CommentModel comment)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            comment.CreatedAt = DateTime.UtcNow;
            db.Comment.Add(comment);
            await db.SaveChangesAsync();
            return comment.Id;
        }

        public async Task<bool> Update(UpdateCommentViewModel commentViewModel)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var comment = await db.Comment.FindAsync(commentViewModel.Id);
            
            if (comment == null) return false;
            
            comment.Content = commentViewModel.Content;
            comment.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
            return true;
        }

        public async Task<bool> Delete(int commentId, int loginId)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var comment = await db.Comment.FindAsync(commentId);
            
            if (comment == null || comment.LoginId != loginId) return false;
            
            comment.IsDeleted = true;
            await db.SaveChangesAsync();
            return true;
        }

        public async Task<List<CommentViewModel>> GetByEntity(CommentEntityType entityType, int entityId)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            
            var comments = await db.Comment
                .Where(c => c.EntityType == entityType && c.EntityId == entityId && !c.IsDeleted)
                .OrderByDescending(c => c.CreatedAt)
                .ToListAsync();

            var result = new List<CommentViewModel>();
            
            foreach (var comment in comments)
            {
                var user = await db.Login.FindAsync(comment.LoginId);
                result.Add(new CommentViewModel
                {
                    Id = comment.Id,
                    Content = comment.Content,
                    LoginId = comment.LoginId,
                    UserName = user?.FullName ?? user?.Login ?? "Unknown",
                    CreatedAt = comment.CreatedAt,
                    UpdatedAt = comment.UpdatedAt,
                    EntityType = comment.EntityType,
                    EntityId = comment.EntityId,
                    IsDeleted = comment.IsDeleted
                });
            }

            return result;
        }

        public async Task<CommentViewModel?> GetById(int commentId)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var comment = await db.Comment.FindAsync(commentId);
            
            if (comment == null) return null;
            
            var user = await db.Login.FindAsync(comment.LoginId);
            return new CommentViewModel
            {
                Id = comment.Id,
                Content = comment.Content,
                LoginId = comment.LoginId,
                UserName = user?.FullName ?? user?.Login ?? "Unknown",
                CreatedAt = comment.CreatedAt,
                UpdatedAt = comment.UpdatedAt,
                EntityType = comment.EntityType,
                EntityId = comment.EntityId,
                IsDeleted = comment.IsDeleted
            };
        }
    }

    public interface ICommentProcessor
    {
        Task<int> Add(CommentModel comment);
        Task<bool> Update(UpdateCommentViewModel commentViewModel);
        Task<bool> Delete(int commentId, int loginId);
        Task<List<CommentViewModel>> GetByEntity(CommentEntityType entityType, int entityId);
        Task<CommentViewModel?> GetById(int commentId);
    }
}

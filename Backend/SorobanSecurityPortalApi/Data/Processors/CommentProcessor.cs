using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Models.DbModels;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace SorobanSecurityPortalApi.Data.Processors
{
    public class CommentProcessor : ICommentProcessor
    {
        private readonly IDbContextFactory<Db> _dbFactory;

        public CommentProcessor(IDbContextFactory<Db> dbFactory)
        {
            _dbFactory = dbFactory;
        }

        public async Task<List<CommentModel>> GetComments(CommentEntityType entityType, int entityId, int page, int pageSize)
        {
            page = Math.Max(1, page);
            pageSize = Math.Max(1, pageSize);

            await using var db = await _dbFactory.CreateDbContextAsync();
            return await db.Comment
                .Include(c => c.Author)
                    .ThenInclude(a => a.UserProfile)
                .Include(c => c.Votes)
                .Include(c => c.Replies.Where(r => !r.IsDeleted))
                    .ThenInclude(r => r.Author)
                        .ThenInclude(a => a.UserProfile)
                .Include(c => c.Replies.Where(r => !r.IsDeleted))
                    .ThenInclude(r => r.Votes)
                .Where(c => c.EntityType == entityType && c.EntityId == entityId && c.ParentId == null && !c.IsDeleted)
                .OrderByDescending(c => c.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();
        }

        public async Task<int> GetCommentsCount(CommentEntityType entityType, int entityId)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            return await db.Comment
                .CountAsync(c => c.EntityType == entityType && c.EntityId == entityId && c.ParentId == null && !c.IsDeleted);
        }

        public async Task<CommentModel?> GetComment(int id)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            return await db.Comment
                .Include(c => c.Author)
                    .ThenInclude(a => a.UserProfile)
                .Include(c => c.Votes)
                .FirstOrDefaultAsync(c => c.Id == id && !c.IsDeleted);
        }

        public async Task<CommentModel> AddComment(CommentModel comment)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            db.Comment.Add(comment);
            await db.SaveChangesAsync();
            
            // Reload to get relations for the return DTO
            return await db.Comment
                .Include(c => c.Author)
                    .ThenInclude(a => a.UserProfile)
                .FirstAsync(c => c.Id == comment.Id);
        }

        public async Task UpdateComment(CommentModel comment)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var existingComment = await db.Comment.FirstOrDefaultAsync(c => c.Id == comment.Id);
            if (existingComment == null)
            {
                return;
            }
            db.Entry(existingComment).CurrentValues.SetValues(comment);
            await db.SaveChangesAsync();
        }

        public async Task Vote(int commentId, int userId, VoteType voteType)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var commentExists = await db.Comment.AnyAsync(c => c.Id == commentId && !c.IsDeleted);
            if (!commentExists)
            {
                throw new KeyNotFoundException("Comment not found");
            }

            var existingVote = await db.CommentVote
                .FirstOrDefaultAsync(v => v.CommentId == commentId && v.UserId == userId);

            if (existingVote != null)
            {
                if (voteType == VoteType.None)
                {
                    db.CommentVote.Remove(existingVote);
                }
                else
                {
                    existingVote.Vote = voteType;
                    db.CommentVote.Update(existingVote);
                }
            }
            else if (voteType != VoteType.None)
            {
                db.CommentVote.Add(new CommentVoteModel
                {
                    CommentId = commentId,
                    UserId = userId,
                    Vote = voteType
                });
            }

            await db.SaveChangesAsync();
        }

        public async Task<VoteType> GetUserVote(int commentId, int userId)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var vote = await db.CommentVote
                .FirstOrDefaultAsync(v => v.CommentId == commentId && v.UserId == userId);
            return vote?.Vote ?? VoteType.None;
        }

        public async Task<Dictionary<int, VoteType>> GetUserVotes(IEnumerable<int> commentIds, int userId)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var votes = await db.CommentVote
                .Where(v => v.UserId == userId && commentIds.Contains(v.CommentId))
                .ToListAsync();
            return votes.ToDictionary(v => v.CommentId, v => v.Vote);
        }
    }

    public interface ICommentProcessor
    {
        Task<List<CommentModel>> GetComments(CommentEntityType entityType, int entityId, int page, int pageSize);
        Task<int> GetCommentsCount(CommentEntityType entityType, int entityId);
        Task<CommentModel?> GetComment(int id);
        Task<CommentModel> AddComment(CommentModel comment);
        Task UpdateComment(CommentModel comment);
        Task Vote(int commentId, int userId, VoteType voteType);
        Task<VoteType> GetUserVote(int commentId, int userId);
        Task<Dictionary<int, VoteType>> GetUserVotes(IEnumerable<int> commentIds, int userId);
    }
}

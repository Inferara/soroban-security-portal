using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Models.DbModels;

namespace SorobanSecurityPortalApi.Data.Processors
{
    public class VoteOutcome
    {
        public bool IsSelfVote { get; set; }
        public int UpvoteCount { get; set; }
        public int DownvoteCount { get; set; }
        public VoteType? CurrentUserVote { get; set; }
    }

    public interface IVoteProcessor
    {
        Task<VoteOutcome?> SetCommentVote(int commentId, int userId, VoteType? newVote);
        Task<Dictionary<int, VoteType>> GetUserVotesForComments(int userId, List<int> commentIds);
    }

    public class VoteProcessor : IVoteProcessor
    {
        private readonly IDbContextFactory<Db> _dbFactory;
        public VoteProcessor(IDbContextFactory<Db> dbFactory) => _dbFactory = dbFactory;

        public async Task<VoteOutcome?> SetCommentVote(int commentId, int userId, VoteType? newVote)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var comment = await db.Comment.FirstOrDefaultAsync(c => c.Id == commentId);
            if (comment == null) return null;

            // Voting on your own comment is not allowed (protects the count + future reputation).
            if (comment.AuthorId == userId)
                return new VoteOutcome { IsSelfVote = true, UpvoteCount = comment.UpvoteCount, DownvoteCount = comment.DownvoteCount };

            var existing = await db.Vote.FirstOrDefaultAsync(
                v => v.UserId == userId && v.EntityType == VotableEntityType.Comment && v.EntityId == commentId);
            var oldVote = existing?.VoteType;

            comment.UpvoteCount += (newVote == VoteType.Upvote ? 1 : 0) - (oldVote == VoteType.Upvote ? 1 : 0);
            comment.DownvoteCount += (newVote == VoteType.Downvote ? 1 : 0) - (oldVote == VoteType.Downvote ? 1 : 0);

            if (newVote == null)
            {
                if (existing != null) db.Vote.Remove(existing);
            }
            else if (existing != null)
            {
                existing.VoteType = newVote.Value;
            }
            else
            {
                db.Vote.Add(new VoteModel
                {
                    UserId = userId,
                    EntityType = VotableEntityType.Comment,
                    EntityId = commentId,
                    VoteType = newVote.Value
                });
            }

            await db.SaveChangesAsync();
            return new VoteOutcome
            {
                IsSelfVote = false,
                UpvoteCount = comment.UpvoteCount,
                DownvoteCount = comment.DownvoteCount,
                CurrentUserVote = newVote
            };
        }

        public async Task<Dictionary<int, VoteType>> GetUserVotesForComments(int userId, List<int> commentIds)
        {
            if (commentIds == null || commentIds.Count == 0) return new Dictionary<int, VoteType>();
            await using var db = await _dbFactory.CreateDbContextAsync();
            var rows = await db.Vote.AsNoTracking()
                .Where(v => v.UserId == userId && v.EntityType == VotableEntityType.Comment && commentIds.Contains(v.EntityId))
                .Select(v => new { v.EntityId, v.VoteType })
                .ToListAsync();
            return rows.ToDictionary(r => r.EntityId, r => r.VoteType);
        }
    }
}

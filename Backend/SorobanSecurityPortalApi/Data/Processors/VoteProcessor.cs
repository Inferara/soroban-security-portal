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
        public bool BelowDownvoteThreshold { get; set; }
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
        // Minimum reputation required to cast a downvote (abuse prevention). Tunable.
        public const int MinReputationToDownvote = 10;

        private readonly IDbContextFactory<Db> _dbFactory;
        public VoteProcessor(IDbContextFactory<Db> dbFactory) => _dbFactory = dbFactory;

        public async Task<VoteOutcome?> SetCommentVote(int commentId, int userId, VoteType? newVote)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var comment = await db.Comment.FirstOrDefaultAsync(c => c.Id == commentId);
            if (comment == null) return null;

            // A hidden/soft-deleted comment isn't publicly visible, so it isn't votable.
            if (comment.IsHidden || comment.IsDeleted) return null;

            // Voting on your own comment is not allowed (protects the count + future reputation).
            if (comment.AuthorId == userId)
                return new VoteOutcome { IsSelfVote = true, UpvoteCount = comment.UpvoteCount, DownvoteCount = comment.DownvoteCount };

            var existing = await db.Vote.FirstOrDefaultAsync(
                v => v.UserId == userId && v.EntityType == VotableEntityType.Comment && v.EntityId == commentId);

            var oldVote = existing?.VoteType;

            // Min-reputation gate: only applies when newly casting a downvote.
            if (newVote == VoteType.Downvote && oldVote != VoteType.Downvote)
            {
                var voterRep = await db.UserProfiles.AsNoTracking()
                    .Where(p => p.LoginId == userId)
                    .Select(p => (int?)p.ReputationScore)
                    .FirstOrDefaultAsync() ?? 0;
                if (voterRep < MinReputationToDownvote)
                    return new VoteOutcome
                    {
                        BelowDownvoteThreshold = true,
                        UpvoteCount = comment.UpvoteCount,
                        DownvoteCount = comment.DownvoteCount,
                        CurrentUserVote = oldVote
                    };
            }

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

            // Recompute counts from the authoritative vote rows — other users' committed votes
            // plus this user's new vote — rather than an in-memory increment, so concurrent votes
            // on the same comment can't lose updates / drift. The unique index keeps the rows
            // themselves correct (one per user).
            var upOthers = await db.Vote.CountAsync(v => v.EntityType == VotableEntityType.Comment
                && v.EntityId == commentId && v.UserId != userId && v.VoteType == VoteType.Upvote);
            var downOthers = await db.Vote.CountAsync(v => v.EntityType == VotableEntityType.Comment
                && v.EntityId == commentId && v.UserId != userId && v.VoteType == VoteType.Downvote);
            comment.UpvoteCount = upOthers + (newVote == VoteType.Upvote ? 1 : 0);
            comment.DownvoteCount = downOthers + (newVote == VoteType.Downvote ? 1 : 0);

            // Author earns +1 reputation per upvote on their comment (reversed when the upvote
            // is removed or flipped). Authors without a profile row simply don't accrue any.
            var repDelta = (newVote == VoteType.Upvote ? 1 : 0) - (oldVote == VoteType.Upvote ? 1 : 0);
            if (repDelta != 0)
            {
                var authorProfile = await db.UserProfiles.FirstOrDefaultAsync(p => p.LoginId == comment.AuthorId);
                if (authorProfile != null) authorProfile.ReputationScore += repDelta;
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

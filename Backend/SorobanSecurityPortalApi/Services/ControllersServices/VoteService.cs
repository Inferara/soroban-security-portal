using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;

namespace SorobanSecurityPortalApi.Services.ControllersServices
{
    public interface IVoteService
    {
        Task<VoteResultViewModel> Vote(int commentId, string voteType);
    }

    public class VoteService : IVoteService
    {
        private readonly IVoteProcessor _processor;
        private readonly IUserContextAccessor _userContext;

        public VoteService(IVoteProcessor processor, IUserContextAccessor userContext)
        {
            _processor = processor;
            _userContext = userContext;
        }

        public async Task<VoteResultViewModel> Vote(int commentId, string voteType)
        {
            var userId = await _userContext.GetLoginIdAsync();
            if (userId == 0) throw new UnauthorizedAccessException("User not logged in.");

            VoteType? parsed = (voteType ?? "").ToLowerInvariant() switch
            {
                "upvote" => VoteType.Upvote,
                "downvote" => VoteType.Downvote,
                "none" => null,
                _ => throw new InvalidOperationException("voteType must be 'upvote', 'downvote', or 'none'.")
            };

            var outcome = await _processor.SetCommentVote(commentId, userId, parsed);
            if (outcome == null) throw new KeyNotFoundException($"Comment with id {commentId} not found.");
            if (outcome.IsSelfVote) throw new InvalidOperationException("You cannot vote on your own comment.");

            return new VoteResultViewModel
            {
                UpvoteCount = outcome.UpvoteCount,
                DownvoteCount = outcome.DownvoteCount,
                CurrentUserVote = ToStr(outcome.CurrentUserVote)
            };
        }

        internal static string? ToStr(VoteType? v) => v switch
        {
            VoteType.Upvote => "upvote",
            VoteType.Downvote => "downvote",
            _ => null
        };
    }
}

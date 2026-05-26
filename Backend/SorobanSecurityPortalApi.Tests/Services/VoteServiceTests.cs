using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using FluentAssertions;
using Moq;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Services.ControllersServices;
using Xunit;

namespace SorobanSecurityPortalApi.Tests.Services
{
    public class VoteServiceTests
    {
        private readonly Mock<IVoteProcessor> _processor = new();
        private readonly Mock<IUserContextAccessor> _userContext = new();
        private VoteService Build() => new VoteService(_processor.Object, _userContext.Object);

        [Fact]
        public async Task Vote_Rejects_Unauthenticated()
        {
            _userContext.Setup(u => u.GetLoginIdAsync()).ReturnsAsync(0);
            await Build().Invoking(s => s.Vote(1, "upvote")).Should().ThrowAsync<UnauthorizedAccessException>();
        }

        [Fact]
        public async Task Vote_Rejects_Invalid_VoteType()
        {
            _userContext.Setup(u => u.GetLoginIdAsync()).ReturnsAsync(5);
            await Build().Invoking(s => s.Vote(1, "sideways")).Should().ThrowAsync<InvalidOperationException>();
        }

        [Fact]
        public async Task Vote_Maps_None_To_Clear()
        {
            _userContext.Setup(u => u.GetLoginIdAsync()).ReturnsAsync(5);
            _processor.Setup(p => p.SetCommentVote(1, 5, null))
                .ReturnsAsync(new VoteOutcome { UpvoteCount = 0, DownvoteCount = 0, CurrentUserVote = null });

            var result = await Build().Vote(1, "none");

            result.CurrentUserVote.Should().BeNull();
            _processor.Verify(p => p.SetCommentVote(1, 5, null), Times.Once);
        }

        [Fact]
        public async Task Vote_Upvote_Returns_Counts_And_State()
        {
            _userContext.Setup(u => u.GetLoginIdAsync()).ReturnsAsync(5);
            _processor.Setup(p => p.SetCommentVote(1, 5, VoteType.Upvote))
                .ReturnsAsync(new VoteOutcome { UpvoteCount = 3, DownvoteCount = 1, CurrentUserVote = VoteType.Upvote });

            var result = await Build().Vote(1, "upvote");

            result.UpvoteCount.Should().Be(3);
            result.DownvoteCount.Should().Be(1);
            result.CurrentUserVote.Should().Be("upvote");
        }

        [Fact]
        public async Task Vote_Throws_NotFound_When_Comment_Missing()
        {
            _userContext.Setup(u => u.GetLoginIdAsync()).ReturnsAsync(5);
            _processor.Setup(p => p.SetCommentVote(99, 5, VoteType.Upvote)).ReturnsAsync((VoteOutcome?)null);
            await Build().Invoking(s => s.Vote(99, "upvote")).Should().ThrowAsync<KeyNotFoundException>();
        }

        [Fact]
        public async Task Vote_Throws_When_SelfVote()
        {
            _userContext.Setup(u => u.GetLoginIdAsync()).ReturnsAsync(5);
            _processor.Setup(p => p.SetCommentVote(1, 5, VoteType.Upvote)).ReturnsAsync(new VoteOutcome { IsSelfVote = true });
            await Build().Invoking(s => s.Vote(1, "upvote")).Should().ThrowAsync<InvalidOperationException>();
        }

        [Fact]
        public async Task Vote_Throws_When_Below_Downvote_Threshold()
        {
            _userContext.Setup(u => u.GetLoginIdAsync()).ReturnsAsync(5);
            _processor.Setup(p => p.SetCommentVote(1, 5, VoteType.Downvote))
                .ReturnsAsync(new VoteOutcome { BelowDownvoteThreshold = true });

            await Build().Invoking(s => s.Vote(1, "downvote"))
                .Should().ThrowAsync<InvalidOperationException>().WithMessage("*reputation*");
        }
    }
}

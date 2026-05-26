using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Moq;
using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Tests.Services;
using Xunit;

namespace SorobanSecurityPortalApi.Tests.Data
{
    public class VoteProcessorTests
    {
        private static Mock<DbSet<T>> Set<T>(List<T> src) where T : class
        {
            var q = src.AsQueryable();
            var m = new Mock<DbSet<T>>();
            m.As<IQueryable<T>>().Setup(x => x.Provider).Returns(new TestAsyncQueryProvider<T>(q.Provider));
            m.As<IQueryable<T>>().Setup(x => x.Expression).Returns(q.Expression);
            m.As<IQueryable<T>>().Setup(x => x.ElementType).Returns(q.ElementType);
            m.As<IQueryable<T>>().Setup(x => x.GetEnumerator()).Returns(q.GetEnumerator());
            m.As<IAsyncEnumerable<T>>().Setup(x => x.GetAsyncEnumerator(It.IsAny<CancellationToken>()))
                .Returns(new TestAsyncEnumerator<T>(q.GetEnumerator()));
            m.Setup(d => d.Add(It.IsAny<T>())).Callback<T>(src.Add);
            m.Setup(d => d.Remove(It.IsAny<T>())).Callback<T>(t => src.Remove(t));
            return m;
        }

        private static (Mock<IDbContextFactory<Db>>, Mock<Db>) Factory(List<CommentModel> comments, List<VoteModel> votes)
        {
            var db = new Mock<Db>(
                new Mock<IDbQuery>().Object,
                new Mock<Microsoft.Extensions.Logging.ILogger<Db>>().Object,
                new Mock<IDataSourceProvider>().Object) { CallBase = true };
            db.Setup(d => d.Comment).Returns(Set(comments).Object);
            db.Setup(d => d.Vote).Returns(Set(votes).Object);
            db.Setup(d => d.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
            var f = new Mock<IDbContextFactory<Db>>();
            f.Setup(x => x.CreateDbContextAsync(It.IsAny<CancellationToken>())).ReturnsAsync(db.Object);
            return (f, db);
        }

        [Fact]
        public async Task SetCommentVote_New_Upvote_Increments_And_AddsRow()
        {
            var comment = new CommentModel { Id = 1, AuthorId = 9, UpvoteCount = 0, DownvoteCount = 0 };
            var votes = new List<VoteModel>();
            var (f, db) = Factory(new List<CommentModel> { comment }, votes);

            var outcome = await new VoteProcessor(f.Object).SetCommentVote(1, userId: 5, newVote: VoteType.Upvote);

            outcome.Should().NotBeNull();
            outcome!.IsSelfVote.Should().BeFalse();
            outcome.UpvoteCount.Should().Be(1);
            outcome.CurrentUserVote.Should().Be(VoteType.Upvote);
            votes.Should().ContainSingle();
            comment.UpvoteCount.Should().Be(1);
            db.Verify(d => d.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task SetCommentVote_Flip_Up_To_Down_Adjusts_Both_Counts()
        {
            var comment = new CommentModel { Id = 1, AuthorId = 9, UpvoteCount = 1, DownvoteCount = 0 };
            var votes = new List<VoteModel> { new() { Id = 1, UserId = 5, EntityType = VotableEntityType.Comment, EntityId = 1, VoteType = VoteType.Upvote } };
            var (f, _) = Factory(new List<CommentModel> { comment }, votes);

            var outcome = await new VoteProcessor(f.Object).SetCommentVote(1, 5, VoteType.Downvote);

            comment.UpvoteCount.Should().Be(0);
            comment.DownvoteCount.Should().Be(1);
            outcome!.CurrentUserVote.Should().Be(VoteType.Downvote);
            votes.Should().ContainSingle(); // same row, flipped
            votes[0].VoteType.Should().Be(VoteType.Downvote);
        }

        [Fact]
        public async Task SetCommentVote_Clear_Removes_Row_And_Decrements()
        {
            var comment = new CommentModel { Id = 1, AuthorId = 9, UpvoteCount = 1, DownvoteCount = 0 };
            var votes = new List<VoteModel> { new() { Id = 1, UserId = 5, EntityType = VotableEntityType.Comment, EntityId = 1, VoteType = VoteType.Upvote } };
            var (f, _) = Factory(new List<CommentModel> { comment }, votes);

            var outcome = await new VoteProcessor(f.Object).SetCommentVote(1, 5, newVote: null);

            comment.UpvoteCount.Should().Be(0);
            outcome!.CurrentUserVote.Should().BeNull();
            votes.Should().BeEmpty();
        }

        [Fact]
        public async Task SetCommentVote_Returns_Null_For_Missing_Comment()
        {
            var (f, _) = Factory(new List<CommentModel>(), new List<VoteModel>());
            (await new VoteProcessor(f.Object).SetCommentVote(999, 5, VoteType.Upvote)).Should().BeNull();
        }

        [Fact]
        public async Task SetCommentVote_SelfVote_Is_Reported_And_NotApplied()
        {
            var comment = new CommentModel { Id = 1, AuthorId = 5, UpvoteCount = 0 };
            var votes = new List<VoteModel>();
            var (f, db) = Factory(new List<CommentModel> { comment }, votes);

            var outcome = await new VoteProcessor(f.Object).SetCommentVote(1, userId: 5, VoteType.Upvote);

            outcome!.IsSelfVote.Should().BeTrue();
            comment.UpvoteCount.Should().Be(0);
            votes.Should().BeEmpty();
            db.Verify(d => d.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task SetCommentVote_Recomputes_Count_From_Votes_Not_StoredValue()
        {
            // Stored count is deliberately WRONG (99); the result must be recomputed from the rows.
            var comment = new CommentModel { Id = 1, AuthorId = 9, UpvoteCount = 99 };
            var votes = new List<VoteModel>
            {
                new() { Id = 1, UserId = 6, EntityType = VotableEntityType.Comment, EntityId = 1, VoteType = VoteType.Upvote },
                new() { Id = 2, UserId = 7, EntityType = VotableEntityType.Comment, EntityId = 1, VoteType = VoteType.Upvote },
            };
            var (f, _) = Factory(new List<CommentModel> { comment }, votes);

            var outcome = await new VoteProcessor(f.Object).SetCommentVote(1, userId: 5, VoteType.Upvote);

            outcome!.UpvoteCount.Should().Be(3); // 2 other upvotes + this user's, NOT 99+1
            comment.UpvoteCount.Should().Be(3);
        }

        [Fact]
        public async Task SetCommentVote_Returns_Null_For_Suppressed_Comment()
        {
            var hidden = new CommentModel { Id = 1, AuthorId = 9, IsHidden = true };
            var (f, _) = Factory(new List<CommentModel> { hidden }, new List<VoteModel>());
            (await new VoteProcessor(f.Object).SetCommentVote(1, 5, VoteType.Upvote)).Should().BeNull();
        }

        [Fact]
        public async Task SetCommentVote_Returns_Null_For_Deleted_Comment()
        {
            var deleted = new CommentModel { Id = 1, AuthorId = 9, IsDeleted = true };
            var (f, _) = Factory(new List<CommentModel> { deleted }, new List<VoteModel>());
            (await new VoteProcessor(f.Object).SetCommentVote(1, 5, VoteType.Upvote)).Should().BeNull();
        }

        [Fact]
        public async Task GetUserVotesForComments_Returns_Map()
        {
            var votes = new List<VoteModel>
            {
                new() { UserId = 5, EntityType = VotableEntityType.Comment, EntityId = 1, VoteType = VoteType.Upvote },
                new() { UserId = 5, EntityType = VotableEntityType.Comment, EntityId = 2, VoteType = VoteType.Downvote },
                new() { UserId = 6, EntityType = VotableEntityType.Comment, EntityId = 1, VoteType = VoteType.Upvote },
            };
            var (f, _) = Factory(new List<CommentModel>(), votes);

            var map = await new VoteProcessor(f.Object).GetUserVotesForComments(5, new List<int> { 1, 2 });

            map[1].Should().Be(VoteType.Upvote);
            map[2].Should().Be(VoteType.Downvote);
            map.Should().HaveCount(2);
        }
    }
}

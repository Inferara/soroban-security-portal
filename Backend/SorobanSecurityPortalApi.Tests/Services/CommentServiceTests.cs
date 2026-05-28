using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using AutoMapper;
using FluentAssertions;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.Mapping;
using SorobanSecurityPortalApi.Models.ViewModels;
using SorobanSecurityPortalApi.Services.ControllersServices;
using Xunit;

namespace SorobanSecurityPortalApi.Tests.Services
{
    public class CommentServiceTests
    {
        private readonly Mock<ICommentProcessor> _processor = new();
        private readonly Mock<IContentFilterService> _filter = new();
        private readonly Mock<IUserContextAccessor> _userContext = new();
        private readonly Mock<IDistributedCache> _cache = new();
        private readonly Mock<IVoteProcessor> _voteProcessor = new();
        private readonly Mock<IMentionProcessor> _mentionProcessor = new();
        private readonly Mock<INotificationService> _notifications = new();
        private readonly Mock<ILogger<CommentService>> _logger = new();
        private readonly IMapper _mapper = new MapperConfiguration(c => c.AddProfile<CommentModelProfile>(), NullLoggerFactory.Instance).CreateMapper();

        public CommentServiceTests()
        {
            // Default catch-all setups registered first so per-test specific setups (registered later) take priority (Moq LIFO).
            _mentionProcessor.Setup(m => m.ReplaceCommentMentions(It.IsAny<int>(), It.IsAny<string>()))
                .ReturnsAsync(new List<int>());
            _notifications.Setup(n => n.NotifyForNewComment(
                It.IsAny<int>(), It.IsAny<int?>(), It.IsAny<IReadOnlyList<int>>(),
                It.IsAny<int>(), It.IsAny<EntityType>(), It.IsAny<int>(), It.IsAny<string>()))
                .Returns(Task.CompletedTask);
        }

        private CommentService Build() =>
            new CommentService(_processor.Object, _filter.Object, _userContext.Object, _mapper, _cache.Object, _voteProcessor.Object, _mentionProcessor.Object, _notifications.Object, _logger.Object);

        private void AllowFilter()
        {
            _filter.Setup(f => f.CheckRateLimitAsync(It.IsAny<int>())).ReturnsAsync(true);
            _filter.Setup(f => f.FilterContentAsync(It.IsAny<string>(), It.IsAny<int>()))
                .ReturnsAsync(new ContentFilterResult { IsBlocked = false, SanitizedContent = "<p>clean</p>" });
        }

        [Fact]
        public async Task GetComments_Nests_Replies_And_Enriches_AuthorNames()
        {
            _processor.Setup(p => p.ListByEntity(EntityType.Report, 9, 1, 20, false))
                .ReturnsAsync(new List<CommentModel> { new() { Id = 1, AuthorId = 5, EntityType = EntityType.Report, EntityId = 9, Content = "top" } });
            _processor.Setup(p => p.ListReplies(EntityType.Report, 9, It.Is<List<int>>(l => l.Contains(1))))
                .ReturnsAsync(new List<CommentModel> { new() { Id = 2, AuthorId = 6, ParentCommentId = 1, EntityType = EntityType.Report, EntityId = 9, Content = "reply" } });
            _processor.Setup(p => p.GetAuthorNames(It.IsAny<List<int>>()))
                .ReturnsAsync(new Dictionary<int, string> { { 5, "Alice" }, { 6, "Bob" } });

            var result = await Build().GetComments(EntityType.Report, 9, 1);

            result.Should().ContainSingle();
            result[0].AuthorName.Should().Be("Alice");
            result[0].ReplyCount.Should().Be(1);
            result[0].Replies.Should().ContainSingle();
            result[0].Replies[0].AuthorName.Should().Be("Bob");
        }

        [Fact]
        public async Task GetComments_Uses_Anonymous_When_AuthorName_Missing()
        {
            _processor.Setup(p => p.ListByEntity(It.IsAny<EntityType>(), It.IsAny<int>(), It.IsAny<int>(), It.IsAny<int>(), false))
                .ReturnsAsync(new List<CommentModel> { new() { Id = 1, AuthorId = 5, Content = "x" } });
            _processor.Setup(p => p.ListReplies(It.IsAny<EntityType>(), It.IsAny<int>(), It.IsAny<List<int>>()))
                .ReturnsAsync(new List<CommentModel>());
            _processor.Setup(p => p.GetAuthorNames(It.IsAny<List<int>>())).ReturnsAsync(new Dictionary<int, string>());

            var result = await Build().GetComments(EntityType.Report, 9, 1);

            result[0].AuthorName.Should().Be("Anonymous");
        }

        [Fact]
        public async Task GetComments_Does_Not_Throw_For_Anonymous_Viewer()
        {
            // Regression: an anonymous reader (no login id) must be able to read comments.
            _processor.Setup(p => p.ListByEntity(It.IsAny<EntityType>(), It.IsAny<int>(), It.IsAny<int>(), It.IsAny<int>(), false))
                .ReturnsAsync(new List<CommentModel> { new() { Id = 1, AuthorId = 5, Content = "x" } });
            _processor.Setup(p => p.ListReplies(It.IsAny<EntityType>(), It.IsAny<int>(), It.IsAny<List<int>>()))
                .ReturnsAsync(new List<CommentModel>());
            _processor.Setup(p => p.GetAuthorNames(It.IsAny<List<int>>())).ReturnsAsync(new Dictionary<int, string>());
            _userContext.Setup(u => u.GetLoginIdOrNullAsync()).ReturnsAsync((int?)null);

            var act = async () => await Build().GetComments(EntityType.Report, 9, 1);

            await act.Should().NotThrowAsync();
            _voteProcessor.Verify(v => v.GetUserVotesForComments(It.IsAny<int>(), It.IsAny<List<int>>()), Times.Never);
        }

        [Fact]
        public async Task GetComments_Enriches_Viewer_Vote_And_IsOwn_For_Authenticated_User()
        {
            _processor.Setup(p => p.ListByEntity(EntityType.Report, 9, 1, 20, false))
                .ReturnsAsync(new List<CommentModel> { new() { Id = 1, AuthorId = 5, EntityType = EntityType.Report, EntityId = 9, Content = "top" } });
            _processor.Setup(p => p.ListReplies(It.IsAny<EntityType>(), It.IsAny<int>(), It.IsAny<List<int>>()))
                .ReturnsAsync(new List<CommentModel>());
            _processor.Setup(p => p.GetAuthorNames(It.IsAny<List<int>>()))
                .ReturnsAsync(new Dictionary<int, string> { { 5, "Alice" } });
            _userContext.Setup(u => u.GetLoginIdOrNullAsync()).ReturnsAsync(5);
            _voteProcessor.Setup(v => v.GetUserVotesForComments(5, It.IsAny<List<int>>()))
                .ReturnsAsync(new Dictionary<int, VoteType> { { 1, VoteType.Upvote } });

            var result = await Build().GetComments(EntityType.Report, 9, 1);

            result[0].IsOwn.Should().BeTrue();
            result[0].CurrentUserVote.Should().Be("upvote");
        }

        [Fact]
        public async Task GetCount_Caches_Result()
        {
            _cache.Setup(c => c.GetAsync(CommentCacheKeysProbe(EntityType.Report, 9), It.IsAny<System.Threading.CancellationToken>()))
                .ReturnsAsync((byte[]?)null);
            _processor.Setup(p => p.CountByEntity(EntityType.Report, 9)).ReturnsAsync(3);

            var count = await Build().GetCount(EntityType.Report, 9);

            count.Should().Be(3);
            _cache.Verify(c => c.SetAsync(It.IsAny<string>(), It.IsAny<byte[]>(), It.IsAny<DistributedCacheEntryOptions>(), It.IsAny<System.Threading.CancellationToken>()), Times.Once);
        }

        // Helper so the test references the same key the service uses.
        private static string CommentCacheKeysProbe(EntityType t, int id) =>
            SorobanSecurityPortalApi.Services.Moderation.CommentCacheKeys.Count(t, id);

        [Fact]
        public async Task AddComment_Rejects_When_Not_Authenticated()
        {
            _userContext.Setup(u => u.GetLoginIdAsync()).ReturnsAsync(0);
            await Build().Invoking(s => s.AddComment(new CreateCommentRequest { EntityType = EntityType.Report, EntityId = 9, Content = "hi" }))
                .Should().ThrowAsync<UnauthorizedAccessException>();
        }

        [Fact]
        public async Task AddComment_Rejects_When_Entity_Missing()
        {
            _userContext.Setup(u => u.GetLoginIdAsync()).ReturnsAsync(5);
            _processor.Setup(p => p.EntityExists(EntityType.Report, 9)).ReturnsAsync(false);
            await Build().Invoking(s => s.AddComment(new CreateCommentRequest { EntityType = EntityType.Report, EntityId = 9, Content = "hi" }))
                .Should().ThrowAsync<KeyNotFoundException>();
        }

        [Fact]
        public async Task AddComment_Rejects_When_Content_Blocked()
        {
            _userContext.Setup(u => u.GetLoginIdAsync()).ReturnsAsync(5);
            _processor.Setup(p => p.EntityExists(EntityType.Report, 9)).ReturnsAsync(true);
            _filter.Setup(f => f.CheckRateLimitAsync(5)).ReturnsAsync(true);
            _filter.Setup(f => f.FilterContentAsync("spam", 5))
                .ReturnsAsync(new ContentFilterResult { IsBlocked = true, Warnings = new List<string> { "spam" } });

            await Build().Invoking(s => s.AddComment(new CreateCommentRequest { EntityType = EntityType.Report, EntityId = 9, Content = "spam" }))
                .Should().ThrowAsync<InvalidOperationException>();
        }

        [Fact]
        public async Task AddComment_Stores_SanitizedHtml_And_Invalidates_Count()
        {
            _userContext.Setup(u => u.GetLoginIdAsync()).ReturnsAsync(5);
            _processor.Setup(p => p.EntityExists(EntityType.Report, 9)).ReturnsAsync(true);
            AllowFilter();
            _processor.Setup(p => p.GetAuthorNames(It.IsAny<List<int>>())).ReturnsAsync(new Dictionary<int, string> { { 5, "Alice" } });
            CommentModel? saved = null;
            _processor.Setup(p => p.Add(It.IsAny<CommentModel>()))
                .ReturnsAsync((CommentModel c) => { c.Id = 100; saved = c; return c; });

            var vm = await Build().AddComment(new CreateCommentRequest { EntityType = EntityType.Report, EntityId = 9, Content = "hello" });

            saved!.AuthorId.Should().Be(5);
            saved.ContentHtml.Should().Be("<p>clean</p>");
            saved.ParentCommentId.Should().BeNull();
            vm.AuthorName.Should().Be("Alice");
            _cache.Verify(c => c.RemoveAsync(CommentCacheKeysProbe(EntityType.Report, 9), It.IsAny<System.Threading.CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task AddComment_Reply_To_Reply_Attaches_To_Actual_Parent()
        {
            _userContext.Setup(u => u.GetLoginIdAsync()).ReturnsAsync(5);
            _processor.Setup(p => p.EntityExists(EntityType.Report, 9)).ReturnsAsync(true);
            AllowFilter();
            _processor.Setup(p => p.GetAuthorNames(It.IsAny<List<int>>())).ReturnsAsync(new Dictionary<int, string>());
            // The user replies to comment 50, which is itself a reply to top-level 1 (depth 2).
            _processor.Setup(p => p.Get(50)).ReturnsAsync(new CommentModel { Id = 50, ParentCommentId = 1, EntityType = EntityType.Report, EntityId = 9 });
            _processor.Setup(p => p.Get(1)).ReturnsAsync(new CommentModel { Id = 1, ParentCommentId = null, EntityType = EntityType.Report, EntityId = 9 });
            CommentModel? saved = null;
            _processor.Setup(p => p.Add(It.IsAny<CommentModel>())).ReturnsAsync((CommentModel c) => { saved = c; return c; });

            await Build().AddComment(new CreateCommentRequest { EntityType = EntityType.Report, EntityId = 9, ParentCommentId = 50, Content = "nested" });

            saved!.ParentCommentId.Should().Be(50); // attaches to the actual parent (multi-level threading)
        }

        [Fact]
        public async Task AddComment_Rejects_Reply_Beyond_Max_Depth()
        {
            _userContext.Setup(u => u.GetLoginIdAsync()).ReturnsAsync(5);
            _processor.Setup(p => p.EntityExists(EntityType.Report, 9)).ReturnsAsync(true);
            AllowFilter();
            // A full depth-5 chain: 5 -> 4 -> 3 -> 2 -> 1 (top). Replying to 5 would be level 6.
            _processor.Setup(p => p.Get(5)).ReturnsAsync(new CommentModel { Id = 5, ParentCommentId = 4, EntityType = EntityType.Report, EntityId = 9 });
            _processor.Setup(p => p.Get(4)).ReturnsAsync(new CommentModel { Id = 4, ParentCommentId = 3, EntityType = EntityType.Report, EntityId = 9 });
            _processor.Setup(p => p.Get(3)).ReturnsAsync(new CommentModel { Id = 3, ParentCommentId = 2, EntityType = EntityType.Report, EntityId = 9 });
            _processor.Setup(p => p.Get(2)).ReturnsAsync(new CommentModel { Id = 2, ParentCommentId = 1, EntityType = EntityType.Report, EntityId = 9 });
            _processor.Setup(p => p.Get(1)).ReturnsAsync(new CommentModel { Id = 1, ParentCommentId = null, EntityType = EntityType.Report, EntityId = 9 });

            await Build().Invoking(s => s.AddComment(new CreateCommentRequest { EntityType = EntityType.Report, EntityId = 9, ParentCommentId = 5, Content = "too deep" }))
                .Should().ThrowAsync<InvalidOperationException>().WithMessage("*depth*");
        }

        [Fact]
        public async Task DeleteComment_Allows_Owner_And_Invalidates_Count()
        {
            _userContext.Setup(u => u.GetLoginIdAsync()).ReturnsAsync(5);
            _processor.Setup(p => p.Get(100)).ReturnsAsync(new CommentModel { Id = 100, AuthorId = 5, EntityType = EntityType.Report, EntityId = 9 });

            await Build().DeleteComment(100);

            _processor.Verify(p => p.SoftDelete(100), Times.Once);
            _cache.Verify(c => c.RemoveAsync(CommentCacheKeysProbe(EntityType.Report, 9), It.IsAny<System.Threading.CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task DeleteComment_Rejects_NonOwner_NonAdmin()
        {
            _userContext.Setup(u => u.GetLoginIdAsync()).ReturnsAsync(7);
            _userContext.Setup(u => u.IsLoginIdAdmin(7)).ReturnsAsync(false);
            _processor.Setup(p => p.Get(100)).ReturnsAsync(new CommentModel { Id = 100, AuthorId = 5 });

            await Build().Invoking(s => s.DeleteComment(100)).Should().ThrowAsync<UnauthorizedAccessException>();
            _processor.Verify(p => p.SoftDelete(It.IsAny<int>()), Times.Never);
        }

        [Fact]
        public async Task GetCount_Returns_Cached_Value_Without_Hitting_Db()
        {
            var key = CommentCacheKeysProbe(EntityType.Report, 9);
            _cache.Setup(c => c.GetAsync(key, It.IsAny<System.Threading.CancellationToken>()))
                .ReturnsAsync(System.Text.Encoding.UTF8.GetBytes("5"));

            var count = await Build().GetCount(EntityType.Report, 9);

            count.Should().Be(5);
            _processor.Verify(p => p.CountByEntity(It.IsAny<EntityType>(), It.IsAny<int>()), Times.Never);
        }

        [Fact]
        public async Task AddComment_Rejects_Parent_On_Different_Entity()
        {
            _userContext.Setup(u => u.GetLoginIdAsync()).ReturnsAsync(5);
            _processor.Setup(p => p.EntityExists(EntityType.Report, 9)).ReturnsAsync(true);
            AllowFilter();
            _processor.Setup(p => p.Get(50)).ReturnsAsync(new CommentModel { Id = 50, EntityType = EntityType.Vulnerability, EntityId = 99 });

            await Build().Invoking(s => s.AddComment(new CreateCommentRequest { EntityType = EntityType.Report, EntityId = 9, ParentCommentId = 50, Content = "x" }))
                .Should().ThrowAsync<KeyNotFoundException>();
        }

        [Fact]
        public async Task AddComment_Reply_To_TopLevel_Parent_Keeps_Parent_Id()
        {
            _userContext.Setup(u => u.GetLoginIdAsync()).ReturnsAsync(5);
            _processor.Setup(p => p.EntityExists(EntityType.Report, 9)).ReturnsAsync(true);
            AllowFilter();
            _processor.Setup(p => p.GetAuthorNames(It.IsAny<List<int>>())).ReturnsAsync(new Dictionary<int, string>());
            _processor.Setup(p => p.Get(1)).ReturnsAsync(new CommentModel { Id = 1, ParentCommentId = null, EntityType = EntityType.Report, EntityId = 9 });
            CommentModel? saved = null;
            _processor.Setup(p => p.Add(It.IsAny<CommentModel>())).ReturnsAsync((CommentModel c) => { saved = c; return c; });

            await Build().AddComment(new CreateCommentRequest { EntityType = EntityType.Report, EntityId = 9, ParentCommentId = 1, Content = "x" });

            saved!.ParentCommentId.Should().Be(1);
        }

        // ── Task 2: UpdateComment + GetEditHistory ──────────────────────────────

        [Fact]
        public async Task UpdateComment_Rejects_When_Not_Authenticated()
        {
            _userContext.Setup(u => u.GetLoginIdAsync()).ReturnsAsync(0);
            await Build().Invoking(s => s.UpdateComment(7, "new"))
                .Should().ThrowAsync<UnauthorizedAccessException>();
        }

        [Fact]
        public async Task UpdateComment_Rejects_NonOwner()
        {
            _userContext.Setup(u => u.GetLoginIdAsync()).ReturnsAsync(5);
            _processor.Setup(p => p.Get(7)).ReturnsAsync(new CommentModel { Id = 7, AuthorId = 6, CreatedAt = DateTime.UtcNow });
            await Build().Invoking(s => s.UpdateComment(7, "new"))
                .Should().ThrowAsync<UnauthorizedAccessException>();
        }

        [Fact]
        public async Task UpdateComment_Rejects_After_Edit_Window()
        {
            _userContext.Setup(u => u.GetLoginIdAsync()).ReturnsAsync(5);
            _processor.Setup(p => p.Get(7)).ReturnsAsync(new CommentModel { Id = 7, AuthorId = 5, CreatedAt = DateTime.UtcNow.AddMinutes(-31) });
            await Build().Invoking(s => s.UpdateComment(7, "new"))
                .Should().ThrowAsync<InvalidOperationException>();
        }

        [Fact]
        public async Task UpdateComment_Rejects_When_Rate_Limited()
        {
            _userContext.Setup(u => u.GetLoginIdAsync()).ReturnsAsync(5);
            _processor.Setup(p => p.Get(7)).ReturnsAsync(
                new CommentModel { Id = 7, AuthorId = 5, CreatedAt = DateTime.UtcNow });
            _filter.Setup(f => f.CheckRateLimitAsync(5)).ReturnsAsync(false);

            await Build().Invoking(s => s.UpdateComment(7, "new"))
                .Should().ThrowAsync<InvalidOperationException>().WithMessage("*Rate limit*");
            _filter.Verify(f => f.FilterContentAsync(It.IsAny<string>(), It.IsAny<int>()), Times.Never);
        }

        [Fact]
        public async Task UpdateComment_Rejects_Blocked_Content()
        {
            _userContext.Setup(u => u.GetLoginIdAsync()).ReturnsAsync(5);
            _processor.Setup(p => p.Get(7)).ReturnsAsync(new CommentModel { Id = 7, AuthorId = 5, CreatedAt = DateTime.UtcNow, Content = "old", EditHistory = "[]" });
            _filter.Setup(f => f.CheckRateLimitAsync(5)).ReturnsAsync(true);
            _filter.Setup(f => f.FilterContentAsync("bad", 5)).ReturnsAsync(new ContentFilterResult { IsBlocked = true, Warnings = new List<string> { "nope" } });
            await Build().Invoking(s => s.UpdateComment(7, "bad"))
                .Should().ThrowAsync<InvalidOperationException>();
        }

        [Fact]
        public async Task UpdateComment_Appends_History_And_Sets_Sanitized_Html()
        {
            _userContext.Setup(u => u.GetLoginIdAsync()).ReturnsAsync(5);
            _processor.Setup(p => p.Get(7)).ReturnsAsync(new CommentModel { Id = 7, AuthorId = 5, CreatedAt = DateTime.UtcNow, Content = "old text", EditHistory = "[]" });
            _filter.Setup(f => f.CheckRateLimitAsync(5)).ReturnsAsync(true);
            _filter.Setup(f => f.FilterContentAsync("new text", 5)).ReturnsAsync(new ContentFilterResult { IsBlocked = false, SanitizedContent = "<p>new text</p>" });
            _processor.Setup(p => p.GetAuthorNames(It.IsAny<List<int>>())).ReturnsAsync(new Dictionary<int, string> { { 5, "Alice" } });
            string? historyJson = null;
            _processor.Setup(p => p.UpdateContent(7, "new text", "<p>new text</p>", It.IsAny<string>()))
                .ReturnsAsync((int _, string c, string h, string hist) =>
                {
                    historyJson = hist;
                    return new CommentModel { Id = 7, AuthorId = 5, Content = c, ContentHtml = h, IsEdited = true, EditHistory = hist };
                });

            var vm = await Build().UpdateComment(7, "new text");

            vm.AuthorName.Should().Be("Alice");
            vm.IsEdited.Should().BeTrue();
            historyJson.Should().Contain("old text"); // previous content captured in the trail
        }

        [Fact]
        public async Task UpdateComment_Rejects_When_Comment_Suppressed()
        {
            _userContext.Setup(u => u.GetLoginIdAsync()).ReturnsAsync(5);
            _processor.Setup(p => p.Get(7)).ReturnsAsync(new CommentModel { Id = 7, AuthorId = 5, CreatedAt = DateTime.UtcNow, IsDeleted = true });
            await Build().Invoking(s => s.UpdateComment(7, "new")).Should().ThrowAsync<KeyNotFoundException>();
        }

        [Fact]
        public async Task GetEditHistory_Returns_Parsed_Entries()
        {
            _processor.Setup(p => p.Get(7)).ReturnsAsync(new CommentModel
            {
                Id = 7,
                EditHistory = "[{\"EditedAt\":\"2026-01-01T00:00:00Z\",\"PreviousContent\":\"v1\"}]"
            });

            var history = await Build().GetEditHistory(7);

            history.Should().ContainSingle();
            history[0].PreviousContent.Should().Be("v1");
        }

        [Fact]
        public async Task GetEditHistory_Throws_For_Missing()
        {
            _processor.Setup(p => p.Get(7)).ReturnsAsync((CommentModel?)null);
            await Build().Invoking(s => s.GetEditHistory(7)).Should().ThrowAsync<KeyNotFoundException>();
        }

        [Fact]
        public async Task AddComment_Stores_Mentions_From_Content()
        {
            _userContext.Setup(u => u.GetLoginIdAsync()).ReturnsAsync(5);
            _processor.Setup(p => p.EntityExists(EntityType.Report, 9)).ReturnsAsync(true);
            AllowFilter();
            _processor.Setup(p => p.GetAuthorNames(It.IsAny<List<int>>())).ReturnsAsync(new Dictionary<int, string> { { 5, "Alice" } });
            _processor.Setup(p => p.Add(It.IsAny<CommentModel>())).ReturnsAsync((CommentModel c) => { c.Id = 100; return c; });

            await Build().AddComment(new CreateCommentRequest { EntityType = EntityType.Report, EntityId = 9, Content = "hey @bob" });

            _mentionProcessor.Verify(m => m.ReplaceCommentMentions(100, "hey @bob"), Times.Once);
        }

        [Fact]
        public async Task AddComment_Notifies_Reply_Author_And_Mentions()
        {
            _userContext.Setup(u => u.GetLoginIdAsync()).ReturnsAsync(5);
            _processor.Setup(p => p.EntityExists(EntityType.Report, 9)).ReturnsAsync(true);
            AllowFilter();
            _processor.Setup(p => p.GetAuthorNames(It.IsAny<List<int>>())).ReturnsAsync(new Dictionary<int, string> { { 5, "Alice" } });
            // Reply to comment 50 authored by user 9.
            _processor.Setup(p => p.Get(50)).ReturnsAsync(new CommentModel { Id = 50, AuthorId = 9, ParentCommentId = null, EntityType = EntityType.Report, EntityId = 9 });
            _processor.Setup(p => p.Add(It.IsAny<CommentModel>())).ReturnsAsync((CommentModel c) => { c.Id = 100; return c; });
            _mentionProcessor.Setup(m => m.ReplaceCommentMentions(100, It.IsAny<string>())).ReturnsAsync(new List<int> { 11, 12 });

            await Build().AddComment(new CreateCommentRequest { EntityType = EntityType.Report, EntityId = 9, ParentCommentId = 50, Content = "ping @x @y" });

            _notifications.Verify(n => n.NotifyForNewComment(
                5,                                   // actor
                9,                                   // replied-to author
                It.Is<IReadOnlyList<int>>(l => l.Contains(11) && l.Contains(12)),
                100, EntityType.Report, 9, "ping @x @y"), Times.Once);
        }

        [Fact]
        public async Task AddComment_TopLevel_Notifies_With_Null_ReplyAuthor()
        {
            _userContext.Setup(u => u.GetLoginIdAsync()).ReturnsAsync(5);
            _processor.Setup(p => p.EntityExists(EntityType.Report, 9)).ReturnsAsync(true);
            AllowFilter();
            _processor.Setup(p => p.GetAuthorNames(It.IsAny<List<int>>())).ReturnsAsync(new Dictionary<int, string>());
            _processor.Setup(p => p.Add(It.IsAny<CommentModel>())).ReturnsAsync((CommentModel c) => { c.Id = 100; return c; });
            _mentionProcessor.Setup(m => m.ReplaceCommentMentions(100, It.IsAny<string>())).ReturnsAsync(new List<int>());

            await Build().AddComment(new CreateCommentRequest { EntityType = EntityType.Report, EntityId = 9, Content = "top-level" });

            _notifications.Verify(n => n.NotifyForNewComment(5, null, It.IsAny<IReadOnlyList<int>>(), 100, EntityType.Report, 9, "top-level"), Times.Once);
        }

        [Fact]
        public async Task GetComments_Sets_IsOwn_For_Viewers_Own_Comments()
        {
            _userContext.Setup(u => u.GetLoginIdOrNullAsync()).ReturnsAsync(5);
            _processor.Setup(p => p.ListByEntity(EntityType.Report, 9, 1, 20, false))
                .ReturnsAsync(new List<CommentModel> {
                    new() { Id = 1, AuthorId = 5, EntityType = EntityType.Report, EntityId = 9, Content = "mine" },
                    new() { Id = 2, AuthorId = 6, EntityType = EntityType.Report, EntityId = 9, Content = "theirs" },
                });
            _processor.Setup(p => p.ListReplies(It.IsAny<EntityType>(), It.IsAny<int>(), It.IsAny<List<int>>())).ReturnsAsync(new List<CommentModel>());
            _processor.Setup(p => p.GetAuthorNames(It.IsAny<List<int>>())).ReturnsAsync(new Dictionary<int, string> { { 5, "Me" }, { 6, "Them" } });
            _voteProcessor.Setup(v => v.GetUserVotesForComments(5, It.IsAny<List<int>>())).ReturnsAsync(new Dictionary<int, SorobanSecurityPortalApi.Models.DbModels.VoteType>());

            var result = await Build().GetComments(EntityType.Report, 9, 1);

            result.Single(c => c.Id == 1).IsOwn.Should().BeTrue();
            result.Single(c => c.Id == 2).IsOwn.Should().BeFalse();
        }

        [Fact]
        public async Task AddComment_SideEffect_Failure_Is_NonFatal()
        {
            _userContext.Setup(u => u.GetLoginIdAsync()).ReturnsAsync(5);
            _processor.Setup(p => p.EntityExists(EntityType.Report, 9)).ReturnsAsync(true);
            AllowFilter();
            _processor.Setup(p => p.GetAuthorNames(It.IsAny<List<int>>())).ReturnsAsync(new Dictionary<int, string> { { 5, "Alice" } });
            _processor.Setup(p => p.Add(It.IsAny<CommentModel>())).ReturnsAsync((CommentModel c) => { c.Id = 100; return c; });
            // The mention/notification side-effect throws — the comment was already saved.
            _mentionProcessor.Setup(m => m.ReplaceCommentMentions(It.IsAny<int>(), It.IsAny<string>()))
                .ThrowsAsync(new Exception("boom"));

            var vm = await Build().Invoking(s => s.AddComment(new CreateCommentRequest { EntityType = EntityType.Report, EntityId = 9, Content = "hi" }))
                .Should().NotThrowAsync();

            vm.Subject.Id.Should().Be(100); // comment creation still succeeds despite the side-effect failure
            _notifications.Verify(n => n.NotifyForNewComment(It.IsAny<int>(), It.IsAny<int?>(), It.IsAny<IReadOnlyList<int>>(), It.IsAny<int>(), It.IsAny<EntityType>(), It.IsAny<int>(), It.IsAny<string>()), Times.Never); // notify not reached after the throw
        }
    }
}

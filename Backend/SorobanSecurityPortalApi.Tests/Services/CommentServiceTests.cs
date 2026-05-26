using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using AutoMapper;
using FluentAssertions;
using Microsoft.Extensions.Caching.Distributed;
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
        private readonly IMapper _mapper = new MapperConfiguration(c => c.AddProfile<CommentModelProfile>(), NullLoggerFactory.Instance).CreateMapper();

        private CommentService Build() =>
            new CommentService(_processor.Object, _filter.Object, _userContext.Object, _mapper, _cache.Object);

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
        public async Task AddComment_Flattens_Reply_To_Top_Level_Parent()
        {
            _userContext.Setup(u => u.GetLoginIdAsync()).ReturnsAsync(5);
            _processor.Setup(p => p.EntityExists(EntityType.Report, 9)).ReturnsAsync(true);
            AllowFilter();
            _processor.Setup(p => p.GetAuthorNames(It.IsAny<List<int>>())).ReturnsAsync(new Dictionary<int, string>());
            // The user replies to comment 50, which is itself a reply to top-level 1.
            _processor.Setup(p => p.Get(50)).ReturnsAsync(new CommentModel { Id = 50, ParentCommentId = 1, EntityType = EntityType.Report, EntityId = 9 });
            CommentModel? saved = null;
            _processor.Setup(p => p.Add(It.IsAny<CommentModel>())).ReturnsAsync((CommentModel c) => { saved = c; return c; });

            await Build().AddComment(new CreateCommentRequest { EntityType = EntityType.Report, EntityId = 9, ParentCommentId = 50, Content = "nested" });

            saved!.ParentCommentId.Should().Be(1); // flattened to the top-level ancestor
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
    }
}

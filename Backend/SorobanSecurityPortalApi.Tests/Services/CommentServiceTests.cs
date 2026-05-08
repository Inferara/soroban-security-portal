using SorobanSecurityPortalApi.Services.ControllersServices;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;
using SorobanSecurityPortalApi.Common;
using AutoMapper;
using Moq;
using Xunit;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace SorobanSecurityPortalApi.Tests.Services
{
    public class CommentServiceTests
    {
        private readonly Mock<ICommentProcessor> _commentProcessorMock;
        private readonly Mock<IMapper> _mapperMock;
        private readonly Mock<IUserContextAccessor> _userContextAccessorMock;
        private readonly Mock<IContentFilterService> _contentFilterServiceMock;
        private readonly Mock<IExtendedConfig> _configMock;
        private readonly CommentService _commentService;

        public CommentServiceTests()
        {
            _commentProcessorMock = new Mock<ICommentProcessor>();
            _mapperMock = new Mock<IMapper>();
            _userContextAccessorMock = new Mock<IUserContextAccessor>();
            _contentFilterServiceMock = new Mock<IContentFilterService>();
            _configMock = new Mock<IExtendedConfig>();
            _commentService = new CommentService(
                _commentProcessorMock.Object,
                _mapperMock.Object,
                _userContextAccessorMock.Object,
                _contentFilterServiceMock.Object,
                _configMock.Object);
        }

        [Fact]
        public async Task GetComments_ShouldReturnMappedCommentsWithVotes()
        {
            // Arrange
            var entityType = CommentEntityType.Protocol;
            var entityId = 1;
            var page = 1;
            var pageSize = 10;
            var comments = new List<CommentModel> { new CommentModel { Id = 1, AuthorId = 1 } };
            var viewModels = new List<CommentViewModel> { new CommentViewModel { Id = 1 } };
            var userVotes = new Dictionary<int, VoteType> { { 1, VoteType.Upvote } };

            _commentProcessorMock.Setup(p => p.GetComments(entityType, entityId, page, pageSize)).ReturnsAsync(comments);
            _mapperMock.Setup(m => m.Map<List<CommentViewModel>>(comments)).Returns(viewModels);
            _commentProcessorMock.Setup(p => p.GetUserVotes(It.IsAny<IEnumerable<int>>(), It.IsAny<int>())).ReturnsAsync(userVotes);
            _userContextAccessorMock.Setup(u => u.GetLoginIdAsync()).ReturnsAsync(1);

            // Act
            var result = await _commentService.GetComments(entityType, entityId, page, pageSize);

            // Assert
            Assert.Equal(viewModels, result);
            Assert.Equal("upvote", result[0].CurrentUserVote);
        }

        [Fact]
        public async Task CreateComment_ShouldCreateAndReturnComment()
        {
            // Arrange
            var createModel = new CommentCreateViewModel { Content = "Test", EntityType = CommentEntityType.Protocol, EntityId = 1 };
            var commentModel = new CommentModel { Id = 1, Content = "Test" };
            var createdComment = new CommentModel { Id = 1 };
            var viewModel = new CommentViewModel { Id = 1 };
            var filterResult = new ContentFilterResult { SanitizedContent = "<p>Test</p>" };

            _mapperMock.Setup(m => m.Map<CommentModel>(createModel)).Returns(commentModel);
            _userContextAccessorMock.Setup(u => u.GetLoginIdAsync()).ReturnsAsync(1);
            _contentFilterServiceMock.Setup(c => c.FilterContentAsync("Test", 1)).ReturnsAsync(filterResult);
            _commentProcessorMock.Setup(p => p.AddComment(It.IsAny<CommentModel>())).ReturnsAsync(createdComment);
            _commentProcessorMock.Setup(p => p.GetComment(1)).ReturnsAsync(createdComment);
            _mapperMock.Setup(m => m.Map<CommentViewModel>(createdComment)).Returns(viewModel);

            // Act
            var result = await _commentService.CreateComment(createModel);

            // Assert
            Assert.Equal(viewModel, result);
        }
    }
}
using Moq;
using Xunit;
using AutoMapper;
using SorobanSecurityPortalApi.Services.ProcessingServices;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace SorobanSecurityPortalApi.Tests.Services
{
    public class CommentServiceTests
    {
        private readonly Mock<ICommentProcessor> _mockProcessor;
        private readonly Mock<IMapper> _mockMapper;
        private readonly CommentService _service;

        public CommentServiceTests()
        {
            _mockProcessor = new Mock<ICommentProcessor>();
            _mockMapper = new Mock<IMapper>();
            
            _service = new CommentService(_mockProcessor.Object, _mockMapper.Object);
        }

        [Fact]
        public async Task PostComment_ShouldDetectMentionsAndGenerateHtml()
        {
            var authorId = 1;
            var entityType = "Vulnerability";
            var entityId = 101;
            var content = "Check this **bug** out!";

            _mockProcessor.Setup(p => p.AddComment(It.IsAny<CommentModel>()))
                .ReturnsAsync((CommentModel c) => { c.Id = 55; return c; });

            _mockProcessor.Setup(p => p.GetCommentById(It.IsAny<int>()))
                .ReturnsAsync(new CommentModel { Id = 55, Content = content });

            await _service.PostComment(authorId, entityType, entityId, content);

            _mockProcessor.Verify(p => p.AddComment(It.Is<CommentModel>(c => 
                c.Mentions != null && 
                c.Mentions.Count == 1 && 
                c.ContentHtml != null && c.ContentHtml.Contains("<strong>bug</strong>") && 
                c.AuthorId == authorId
            )), Times.Once);
        }

        [Fact]
        public async Task GetThreadedComments_ShouldBuildHierarchy()
        {
            var rawModels = new List<CommentModel>(); 
            var flatViewModels = new List<CommentViewModel>
            {
                new CommentViewModel { Id = 10, ParentCommentId = null, Content = "Root" },
                new CommentViewModel { Id = 11, ParentCommentId = 10, Content = "Child" }
            };

            _mockProcessor.Setup(p => p.GetCommentsForEntity("Report", 1))
                .ReturnsAsync(rawModels);

            _mockMapper.Setup(m => m.Map<List<CommentViewModel>>(It.IsAny<List<CommentModel>>()))
                .Returns(flatViewModels);

            var result = await _service.GetThreadedComments("Report", 1);

            Assert.Single(result); 
            Assert.Equal(10, result[0].Id);
            Assert.Single(result[0].Replies); 
            Assert.Equal(11, result[0].Replies[0].Id);
        }
    }
}
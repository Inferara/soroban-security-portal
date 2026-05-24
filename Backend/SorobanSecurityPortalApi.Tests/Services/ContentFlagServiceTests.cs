using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Moq;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;
using SorobanSecurityPortalApi.Services.ControllersServices;
using SorobanSecurityPortalApi.Services.Moderation;
using Xunit;

namespace SorobanSecurityPortalApi.Tests.Services
{
    public class ContentFlagServiceTests
    {
        private readonly Mock<IContentFlagProcessor> _flagsMock;
        private readonly Mock<IModerationTargetRegistry> _registryMock;
        private readonly Mock<IUserContextAccessor> _userContextMock;
        private readonly Mock<IModerationTarget> _targetMock;

        public ContentFlagServiceTests()
        {
            _flagsMock = new Mock<IContentFlagProcessor>();
            _registryMock = new Mock<IModerationTargetRegistry>();
            _userContextMock = new Mock<IUserContextAccessor>();
            _targetMock = new Mock<IModerationTarget>();
        }

        private ContentFlagService CreateService()
            => new ContentFlagService(_flagsMock.Object, _registryMock.Object, _userContextMock.Object);

        private void SetupValidTarget(int contentId, ModerationTargetInfo? info)
        {
            IModerationTarget outTarget = _targetMock.Object;
            _registryMock
                .Setup(r => r.TryGet(ModeratedContentType.Vulnerability, out outTarget))
                .Returns(true);
            _targetMock
                .Setup(t => t.Get(contentId))
                .ReturnsAsync(info);
        }

        private void SetupUser(int userId)
        {
            _userContextMock
                .Setup(u => u.GetLoginIdAsync())
                .ReturnsAsync(userId);
        }

        // --- Success case ---

        [Fact]
        public async Task Flag_Success_AddCalledOnce()
        {
            // Arrange
            var contentId = 42;
            SetupValidTarget(contentId, new ModerationTargetInfo { Preview = "Preview", FullContent = "Full", AuthorUserId = 5 });
            SetupUser(10);
            _flagsMock
                .Setup(f => f.Exists(ModeratedContentType.Vulnerability, contentId, 10))
                .ReturnsAsync(false);
            _flagsMock
                .Setup(f => f.Add(It.IsAny<ContentFlagModel>()))
                .Returns(Task.CompletedTask);

            var service = CreateService();
            var request = new FlagContentRequest
            {
                ContentType = "vulnerability",
                ContentId = contentId,
                Reason = "Spam",
                Comment = "test"
            };

            // Act
            var result = await service.Flag(request);

            // Assert
            result.Should().BeOfType<Result<bool, string>.Ok>();
            _flagsMock.Verify(f => f.Add(It.Is<ContentFlagModel>(m =>
                m.ContentType == ModeratedContentType.Vulnerability &&
                m.ContentId == contentId &&
                m.FlaggedByUserId == 10 &&
                m.Reason == FlagReason.Spam &&
                m.Comment == "test"
            )), Times.Once);
        }

        // --- Duplicate flag ---

        [Fact]
        public async Task Flag_AlreadyFlagged_ReturnsErr_AndAddNotCalled()
        {
            // Arrange
            var contentId = 1;
            SetupValidTarget(contentId, new ModerationTargetInfo { Preview = "P", FullContent = "F", AuthorUserId = 1 });
            SetupUser(7);
            _flagsMock
                .Setup(f => f.Exists(ModeratedContentType.Vulnerability, contentId, 7))
                .ReturnsAsync(true);

            var service = CreateService();
            var request = new FlagContentRequest
            {
                ContentType = "vulnerability",
                ContentId = contentId,
                Reason = "Spam"
            };

            // Act
            var result = await service.Flag(request);

            // Assert
            result.Should().BeOfType<Result<bool, string>.Err>();
            var err = (Result<bool, string>.Err)result;
            err.Error.Should().Be("Already flagged");
            _flagsMock.Verify(f => f.Add(It.IsAny<ContentFlagModel>()), Times.Never);
        }

        // --- Content not found ---

        [Fact]
        public async Task Flag_ContentNotFound_ReturnsErr_ContentNotFound()
        {
            // Arrange
            var contentId = 999;
            SetupValidTarget(contentId, null);

            var service = CreateService();
            var request = new FlagContentRequest
            {
                ContentType = "vulnerability",
                ContentId = contentId,
                Reason = "Spam"
            };

            // Act
            var result = await service.Flag(request);

            // Assert
            result.Should().BeOfType<Result<bool, string>.Err>();
            var err = (Result<bool, string>.Err)result;
            err.Error.Should().Be("Content not found");
            _flagsMock.Verify(f => f.Add(It.IsAny<ContentFlagModel>()), Times.Never);
        }

        // --- Invalid content type ---

        [Fact]
        public async Task Flag_InvalidContentType_ReturnsErr()
        {
            // Arrange
            var service = CreateService();
            var request = new FlagContentRequest
            {
                ContentType = "bogus",
                ContentId = 1,
                Reason = "Spam"
            };

            // Act
            var result = await service.Flag(request);

            // Assert
            result.Should().BeOfType<Result<bool, string>.Err>();
            var err = (Result<bool, string>.Err)result;
            err.Error.Should().Be("Invalid content type");
            _flagsMock.Verify(f => f.Add(It.IsAny<ContentFlagModel>()), Times.Never);
        }

        // --- Invalid reason ---

        [Fact]
        public async Task Flag_InvalidReason_ReturnsErr()
        {
            // Arrange
            var service = CreateService();
            var request = new FlagContentRequest
            {
                ContentType = "vulnerability",
                ContentId = 1,
                Reason = "NotARealReason"
            };

            // Act
            var result = await service.Flag(request);

            // Assert
            result.Should().BeOfType<Result<bool, string>.Err>();
            var err = (Result<bool, string>.Err)result;
            err.Error.Should().Be("Invalid reason");
        }

        // --- Registry returns false (no target) ---

        [Fact]
        public async Task Flag_RegistryReturnsNoTarget_ReturnsErr_InvalidContentType()
        {
            // Arrange
            IModerationTarget outTarget = null!;
            _registryMock
                .Setup(r => r.TryGet(ModeratedContentType.Report, out outTarget))
                .Returns(false);

            var service = CreateService();
            var request = new FlagContentRequest
            {
                ContentType = "report",
                ContentId = 1,
                Reason = "Spam"
            };

            // Act
            var result = await service.Flag(request);

            // Assert
            result.Should().BeOfType<Result<bool, string>.Err>();
            var err = (Result<bool, string>.Err)result;
            err.Error.Should().Be("Invalid content type");
        }
    }
}

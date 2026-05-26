using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using AutoMapper;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.Mapping;
using SorobanSecurityPortalApi.Models.ViewModels;
using SorobanSecurityPortalApi.Services.ControllersServices;
using SorobanSecurityPortalApi.Services.Realtime;
using Xunit;

namespace SorobanSecurityPortalApi.Tests.Services
{
    public class NotificationServiceTests
    {
        private readonly Mock<INotificationProcessor> _processor = new();
        private readonly Mock<IUserContextAccessor> _userContext = new();
        private readonly IMapper _mapper = new MapperConfiguration(c => c.AddProfile<NotificationModelProfile>(), NullLoggerFactory.Instance).CreateMapper();
        private readonly Mock<IRealtimePublisher> _publisher = new();
        private NotificationService Build() => new(_processor.Object, _userContext.Object, _mapper, _publisher.Object);

        [Fact]
        public async Task GetUnreadCount_Uses_Current_User()
        {
            _userContext.Setup(u => u.GetLoginIdAsync()).ReturnsAsync(5);
            _processor.Setup(p => p.UnreadCount(5)).ReturnsAsync(3);
            (await Build().GetUnreadCount()).Should().Be(3);
        }

        [Fact]
        public async Task NotifyForNewComment_Reply_To_Other_Creates_Reply_Notification()
        {
            List<NotificationModel>? saved = null;
            _processor.Setup(p => p.AddRange(It.IsAny<IEnumerable<NotificationModel>>()))
                .Callback<IEnumerable<NotificationModel>>(x => saved = x.ToList()).Returns(Task.CompletedTask);

            await Build().NotifyForNewComment(actorId: 5, repliedToAuthorId: 9, mentionedUserIds: new List<int>(),
                commentId: 100, EntityType.Report, entityId: 7, "hi");

            saved.Should().ContainSingle();
            saved![0].Type.Should().Be(NotificationType.CommentReply);
            saved[0].RecipientUserId.Should().Be(9);
            saved[0].ActorUserId.Should().Be(5);
            saved[0].CommentId.Should().Be(100);
        }

        [Fact]
        public async Task NotifyForNewComment_Does_Not_Notify_Self_Reply()
        {
            await Build().NotifyForNewComment(5, repliedToAuthorId: 5, new List<int>(), 100, EntityType.Report, 7, "x");
            _processor.Verify(p => p.AddRange(It.IsAny<IEnumerable<NotificationModel>>()), Times.Never);
        }

        [Fact]
        public async Task NotifyForNewComment_Mentions_Exclude_Actor_And_Reply_Recipient()
        {
            List<NotificationModel>? saved = null;
            _processor.Setup(p => p.AddRange(It.IsAny<IEnumerable<NotificationModel>>()))
                .Callback<IEnumerable<NotificationModel>>(x => saved = x.ToList()).Returns(Task.CompletedTask);

            // actor 5, reply to 9; mentions 5 (self), 9 (already getting reply), 11, 12
            await Build().NotifyForNewComment(5, 9, new List<int> { 5, 9, 11, 12 }, 100, EntityType.Report, 7, "hi @x");

            var mentionRecipients = saved!.Where(n => n.Type == NotificationType.Mention).Select(n => n.RecipientUserId).ToList();
            mentionRecipients.Should().BeEquivalentTo(new[] { 11, 12 });
            saved.Count(n => n.RecipientUserId == 9).Should().Be(1); // 9 gets reply only, not a duplicate mention
        }

        [Fact]
        public async Task NotifyForNewComment_Caps_Mentions()
        {
            List<NotificationModel>? saved = null;
            _processor.Setup(p => p.AddRange(It.IsAny<IEnumerable<NotificationModel>>()))
                .Callback<IEnumerable<NotificationModel>>(x => saved = x.ToList()).Returns(Task.CompletedTask);

            var many = Enumerable.Range(100, 50).ToList(); // 50 distinct mentioned users
            await Build().NotifyForNewComment(5, null, many, 100, EntityType.Report, 7, "x");

            saved!.Count(n => n.Type == NotificationType.Mention).Should().Be(NotificationService.MaxMentionNotifications);
        }

        [Fact]
        public async Task NotifyForNewComment_No_Recipients_Skips_Persist()
        {
            await Build().NotifyForNewComment(5, null, new List<int> { 5 }, 100, EntityType.Report, 7, "x");
            _processor.Verify(p => p.AddRange(It.IsAny<IEnumerable<NotificationModel>>()), Times.Never);
        }

        [Fact]
        public async Task NotifyForNewComment_Pushes_Each_Persisted_Notification_Realtime()
        {
            await Build().NotifyForNewComment(5, repliedToAuthorId: 9, mentionedUserIds: new List<int> { 11 },
                commentId: 100, EntityType.Report, entityId: 7, "hi");

            // recipients: 9 (reply) + 11 (mention) = 2 live pushes
            _publisher.Verify(p => p.NotifyUserAsync(9, It.IsAny<NotificationViewModel>()), Times.Once);
            _publisher.Verify(p => p.NotifyUserAsync(11, It.IsAny<NotificationViewModel>()), Times.Once);
        }
    }
}

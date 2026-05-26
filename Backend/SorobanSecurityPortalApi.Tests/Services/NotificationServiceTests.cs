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
        private readonly Mock<ILoginProcessor> _loginProcessor = new();

        public NotificationServiceTests()
        {
            // Default: no names known — prevents NRE in existing tests.
            _loginProcessor.Setup(l => l.GetDisplayNames(It.IsAny<List<int>>()))
                .ReturnsAsync(new Dictionary<int, string>());
        }

        private NotificationService Build() => new(_processor.Object, _userContext.Object, _mapper, _publisher.Object, _loginProcessor.Object);

        [Fact]
        public async Task GetUnreadCount_Uses_Current_User()
        {
            _userContext.Setup(u => u.GetLoginIdAsync()).ReturnsAsync(5);
            _processor.Setup(p => p.UnreadCount(5)).ReturnsAsync(3);
            (await Build().GetUnreadCount()).Should().Be(3);
        }

        [Fact]
        public async Task GetNotifications_Enriches_ActorName()
        {
            _userContext.Setup(u => u.GetLoginIdAsync()).ReturnsAsync(1);
            _processor.Setup(p => p.ListForUser(1, null, 1, 20))
                .ReturnsAsync(new List<NotificationModel>
                {
                    new() { Id = 1, ActorUserId = 9, RecipientUserId = 1, CommentId = 100,
                            EntityType = EntityType.Report, EntityId = 7,
                            Type = NotificationType.CommentReply, Preview = "hi" }
                });
            _loginProcessor.Setup(l => l.GetDisplayNames(It.Is<List<int>>(ids => ids.Contains(9))))
                .ReturnsAsync(new Dictionary<int, string> { [9] = "Alice" });

            var result = await Build().GetNotifications(null, 1);

            result.Should().ContainSingle();
            result[0].ActorName.Should().Be("Alice");
        }

        [Fact]
        public async Task GetNotifications_ActorName_Fallback_To_Unknown_When_Not_Resolved()
        {
            _userContext.Setup(u => u.GetLoginIdAsync()).ReturnsAsync(1);
            _processor.Setup(p => p.ListForUser(1, null, 1, 20))
                .ReturnsAsync(new List<NotificationModel>
                {
                    new() { Id = 2, ActorUserId = 42, RecipientUserId = 1, CommentId = 55,
                            EntityType = EntityType.Report, EntityId = 3,
                            Type = NotificationType.Mention, Preview = "yo" }
                });
            // default setup returns empty dict → actor 42 not resolved

            var result = await Build().GetNotifications(null, 1);

            result[0].ActorName.Should().Be("Unknown");
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

        [Fact]
        public async Task NotifyForNewComment_Realtime_Push_Carries_ActorName()
        {
            _loginProcessor.Setup(l => l.GetDisplayNames(It.Is<List<int>>(ids => ids.Contains(5))))
                .ReturnsAsync(new Dictionary<int, string> { [5] = "Bob" });

            NotificationViewModel? pushed = null;
            _publisher.Setup(p => p.NotifyUserAsync(9, It.IsAny<NotificationViewModel>()))
                .Callback<int, NotificationViewModel>((_, vm) => pushed = vm)
                .Returns(Task.CompletedTask);

            await Build().NotifyForNewComment(actorId: 5, repliedToAuthorId: 9, mentionedUserIds: new List<int>(),
                commentId: 100, EntityType.Report, entityId: 7, "hi");

            pushed.Should().NotBeNull();
            pushed!.ActorName.Should().Be("Bob");
        }
    }
}

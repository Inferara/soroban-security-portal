using System;
using System.Collections.Generic;
using System.Linq;
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
    public class ModerationServiceTests
    {
        private readonly Mock<IContentFlagProcessor> _flagsMock = new();
        private readonly Mock<IModerationActionProcessor> _actionsMock = new();
        private readonly Mock<IModerationTargetRegistry> _registryMock = new();
        private readonly Mock<IUserContextAccessor> _userContextMock = new();
        private readonly Mock<ILoginProcessor> _loginProcessorMock = new();
        private readonly Mock<IUserProfileProcessor> _profileProcessorMock = new();
        private readonly Mock<IModerationTarget> _vulnTargetMock = new();

        public ModerationServiceTests()
        {
            // Default: CountSince returns 0
            _actionsMock
                .Setup(a => a.CountSince(It.IsAny<DateTime>()))
                .ReturnsAsync(0);

            // Default: login and profile return empty/null
            _loginProcessorMock
                .Setup(l => l.GetById(It.IsAny<int>()))
                .ReturnsAsync((LoginModel?)null);
            _profileProcessorMock
                .Setup(p => p.GetByLoginIdAsync(It.IsAny<int>()))
                .ReturnsAsync((UserProfileModel?)null);
        }

        private ModerationService CreateService()
            => new ModerationService(
                _flagsMock.Object,
                _actionsMock.Object,
                _registryMock.Object,
                _userContextMock.Object,
                _loginProcessorMock.Object,
                _profileProcessorMock.Object);

        private void SetupVulnTarget(int contentId, ModerationTargetInfo? info)
        {
            IModerationTarget outTarget = _vulnTargetMock.Object;
            _registryMock
                .Setup(r => r.TryGet(ModeratedContentType.Vulnerability, out outTarget))
                .Returns(true);
            _vulnTargetMock
                .Setup(t => t.Get(contentId))
                .ReturnsAsync(info);
        }

        // --- Queue aggregation: two flags on same (vuln, 1) → FlagCount=2, reason map ---

        [Fact]
        public async Task GetQueue_TwoFlagsOnSameItem_AggregatesToFlagCount2_WithReasonMap()
        {
            // Arrange
            var baseTime = new DateTime(2026, 1, 10, 12, 0, 0, DateTimeKind.Utc);
            var flags = new List<ContentFlagModel>
            {
                new() { Id = 1, ContentType = ModeratedContentType.Vulnerability, ContentId = 1, FlaggedByUserId = 10, Reason = FlagReason.Spam, CreatedAt = baseTime },
                new() { Id = 2, ContentType = ModeratedContentType.Vulnerability, ContentId = 1, FlaggedByUserId = 11, Reason = FlagReason.Inappropriate, CreatedAt = baseTime.AddHours(1) }
            };
            _flagsMock.Setup(f => f.GetAll()).ReturnsAsync(flags);
            _actionsMock.Setup(a => a.GetAll()).ReturnsAsync(new List<ModerationActionModel>());

            SetupVulnTarget(1, new ModerationTargetInfo { Preview = "Re-entry bug", FullContent = "Full text", AuthorUserId = 5 });

            var service = CreateService();

            // Act
            var queue = await service.GetQueue(null, null, 1);

            // Assert
            queue.Should().HaveCount(1);
            var item = queue[0];
            item.FlagCount.Should().Be(2);
            item.Reasons.Should().ContainKey("spam").WhoseValue.Should().Be(1);
            item.Reasons.Should().ContainKey("inappropriate").WhoseValue.Should().Be(1);
            item.Id.Should().Be("vulnerability:1");
        }

        // --- Status = pending when no action ---

        [Fact]
        public async Task GetQueue_NoAction_StatusIsPending()
        {
            // Arrange
            var flags = new List<ContentFlagModel>
            {
                new() { Id = 1, ContentType = ModeratedContentType.Vulnerability, ContentId = 1, FlaggedByUserId = 10, Reason = FlagReason.Spam, CreatedAt = DateTime.UtcNow }
            };
            _flagsMock.Setup(f => f.GetAll()).ReturnsAsync(flags);
            _actionsMock.Setup(a => a.GetAll()).ReturnsAsync(new List<ModerationActionModel>());
            SetupVulnTarget(1, new ModerationTargetInfo { Preview = "P", FullContent = "F", AuthorUserId = 1 });

            var service = CreateService();

            // Act
            var queue = await service.GetQueue(null, null, 1);

            // Assert
            queue.Should().HaveCount(1);
            queue[0].Status.Should().Be("pending");
        }

        // --- Status = hidden after a Hide action ---

        [Fact]
        public async Task GetQueue_AfterHideAction_StatusIsHidden()
        {
            // Arrange
            var flagTime = new DateTime(2026, 1, 5, 0, 0, 0, DateTimeKind.Utc);
            var actionTime = flagTime.AddHours(1);

            var flags = new List<ContentFlagModel>
            {
                new() { Id = 1, ContentType = ModeratedContentType.Vulnerability, ContentId = 1, FlaggedByUserId = 10, Reason = FlagReason.Spam, CreatedAt = flagTime }
            };
            var actions = new List<ModerationActionModel>
            {
                new() { Id = 1, ContentType = ModeratedContentType.Vulnerability, ContentId = 1, ModeratorId = 99, Action = ModerationActionType.Hide, CreatedAt = actionTime }
            };
            _flagsMock.Setup(f => f.GetAll()).ReturnsAsync(flags);
            _actionsMock.Setup(a => a.GetAll()).ReturnsAsync(actions);
            SetupVulnTarget(1, new ModerationTargetInfo { Preview = "P", FullContent = "F", AuthorUserId = 1 });

            var service = CreateService();

            // Act
            var queue = await service.GetQueue(null, null, 1);

            // Assert
            queue.Should().HaveCount(1);
            queue[0].Status.Should().Be("hidden");
        }

        // --- Re-queue: flag newer than last action → status pending ---

        [Fact]
        public async Task GetQueue_FlagNewerThanLastAction_ReturnsStatusPending()
        {
            // Arrange
            var actionTime = new DateTime(2026, 1, 5, 0, 0, 0, DateTimeKind.Utc);
            var newFlagTime = actionTime.AddDays(1); // newer than the action

            var flags = new List<ContentFlagModel>
            {
                new() { Id = 1, ContentType = ModeratedContentType.Vulnerability, ContentId = 1, FlaggedByUserId = 10, Reason = FlagReason.Spam, CreatedAt = actionTime.AddHours(-1) },
                new() { Id = 2, ContentType = ModeratedContentType.Vulnerability, ContentId = 1, FlaggedByUserId = 12, Reason = FlagReason.Other, CreatedAt = newFlagTime }
            };
            var actions = new List<ModerationActionModel>
            {
                new() { Id = 1, ContentType = ModeratedContentType.Vulnerability, ContentId = 1, ModeratorId = 99, Action = ModerationActionType.Hide, CreatedAt = actionTime }
            };
            _flagsMock.Setup(f => f.GetAll()).ReturnsAsync(flags);
            _actionsMock.Setup(a => a.GetAll()).ReturnsAsync(actions);
            SetupVulnTarget(1, new ModerationTargetInfo { Preview = "P", FullContent = "F", AuthorUserId = 1 });

            var service = CreateService();

            // Act
            var queue = await service.GetQueue(null, null, 1);

            // Assert
            queue.Should().HaveCount(1);
            queue[0].Status.Should().Be("pending");
        }

        // --- TakeAction Hide: calls target.Hide and records action ---

        [Fact]
        public async Task TakeAction_Hide_CallsTargetHide_AndRecordsAction()
        {
            // Arrange
            _userContextMock.Setup(u => u.GetLoginIdAsync()).ReturnsAsync(99);
            _actionsMock.Setup(a => a.Add(It.IsAny<ModerationActionModel>())).Returns(Task.CompletedTask);
            _vulnTargetMock.Setup(t => t.Hide(1)).Returns(Task.CompletedTask);

            IModerationTarget outTarget = _vulnTargetMock.Object;
            _registryMock.Setup(r => r.TryGet(ModeratedContentType.Vulnerability, out outTarget)).Returns(true);

            var service = CreateService();
            var request = new ModerationActionRequest
            {
                ContentType = "vulnerability",
                ContentId = 1,
                Action = "Hide",
                Reason = "Violates policy"
            };

            // Act
            var result = await service.TakeAction(request);

            // Assert
            result.Should().BeOfType<Result<bool, string>.Ok>();
            _vulnTargetMock.Verify(t => t.Hide(1), Times.Once);
            _actionsMock.Verify(a => a.Add(It.Is<ModerationActionModel>(m =>
                m.ContentType == ModeratedContentType.Vulnerability &&
                m.ContentId == 1 &&
                m.ModeratorId == 99 &&
                m.Action == ModerationActionType.Hide &&
                m.Reason == "Violates policy"
            )), Times.Once);
        }

        // --- TakeAction Hide with empty reason → Err ---

        [Fact]
        public async Task TakeAction_Hide_EmptyReason_ReturnsErr()
        {
            // Arrange
            IModerationTarget outTarget = _vulnTargetMock.Object;
            _registryMock.Setup(r => r.TryGet(It.IsAny<ModeratedContentType>(), out outTarget)).Returns(true);

            var service = CreateService();
            var request = new ModerationActionRequest
            {
                ContentType = "vulnerability",
                ContentId = 1,
                Action = "Hide",
                Reason = "   " // whitespace only
            };

            // Act
            var result = await service.TakeAction(request);

            // Assert
            result.Should().BeOfType<Result<bool, string>.Err>();
            var err = (Result<bool, string>.Err)result;
            err.Error.Should().Be("Reason is required for hide/delete");
            _actionsMock.Verify(a => a.Add(It.IsAny<ModerationActionModel>()), Times.Never);
        }

        // --- TakeAction Delete with empty reason → Err ---

        [Fact]
        public async Task TakeAction_Delete_EmptyReason_ReturnsErr()
        {
            // Arrange
            var service = CreateService();
            var request = new ModerationActionRequest
            {
                ContentType = "vulnerability",
                ContentId = 1,
                Action = "Delete",
                Reason = null
            };

            // Act
            var result = await service.TakeAction(request);

            // Assert
            result.Should().BeOfType<Result<bool, string>.Err>();
            var err = (Result<bool, string>.Err)result;
            err.Error.Should().Be("Reason is required for hide/delete");
        }

        // --- TakeAction Approve: calls target.Restore ---

        [Fact]
        public async Task TakeAction_Approve_CallsTargetRestore()
        {
            // Arrange
            _userContextMock.Setup(u => u.GetLoginIdAsync()).ReturnsAsync(99);
            _actionsMock.Setup(a => a.Add(It.IsAny<ModerationActionModel>())).Returns(Task.CompletedTask);
            _vulnTargetMock.Setup(t => t.Restore(1)).Returns(Task.CompletedTask);

            IModerationTarget outTarget = _vulnTargetMock.Object;
            _registryMock.Setup(r => r.TryGet(ModeratedContentType.Vulnerability, out outTarget)).Returns(true);

            var service = CreateService();
            var request = new ModerationActionRequest
            {
                ContentType = "vulnerability",
                ContentId = 1,
                Action = "Approve",
                Reason = null
            };

            // Act
            var result = await service.TakeAction(request);

            // Assert
            result.Should().BeOfType<Result<bool, string>.Ok>();
            _vulnTargetMock.Verify(t => t.Restore(1), Times.Once);
        }

        // --- TakeAction invalid action ---

        [Fact]
        public async Task TakeAction_InvalidAction_ReturnsErr()
        {
            // Arrange
            var service = CreateService();
            var request = new ModerationActionRequest
            {
                ContentType = "vulnerability",
                ContentId = 1,
                Action = "Teleport"
            };

            // Act
            var result = await service.TakeAction(request);

            // Assert
            result.Should().BeOfType<Result<bool, string>.Err>();
            var err = (Result<bool, string>.Err)result;
            err.Error.Should().Be("Invalid action");
        }

        // --- TakeAction invalid content type ---

        [Fact]
        public async Task TakeAction_InvalidContentType_ReturnsErr()
        {
            // Arrange
            var service = CreateService();
            var request = new ModerationActionRequest
            {
                ContentType = "forum_post",
                ContentId = 1,
                Action = "Hide",
                Reason = "Some reason"
            };

            // Act
            var result = await service.TakeAction(request);

            // Assert
            result.Should().BeOfType<Result<bool, string>.Err>();
            var err = (Result<bool, string>.Err)result;
            err.Error.Should().Be("Invalid content type");
        }

        // --- GetStats: QueueSize from pending queue + CountSince values ---

        [Fact]
        public async Task GetStats_ReturnsCorrectQueueSizeAndActionCounts()
        {
            // Arrange: one pending flag item
            var flagTime = new DateTime(2026, 1, 10, 0, 0, 0, DateTimeKind.Utc);
            var flags = new List<ContentFlagModel>
            {
                new() { Id = 1, ContentType = ModeratedContentType.Vulnerability, ContentId = 1, FlaggedByUserId = 10, Reason = FlagReason.Spam, CreatedAt = flagTime }
            };
            _flagsMock.Setup(f => f.GetAll()).ReturnsAsync(flags);
            _actionsMock.Setup(a => a.GetAll()).ReturnsAsync(new List<ModerationActionModel>());
            SetupVulnTarget(1, new ModerationTargetInfo { Preview = "P", FullContent = "F", AuthorUserId = 1 });

            _actionsMock.Setup(a => a.CountSince(It.IsAny<DateTime>())).ReturnsAsync(5);

            var service = CreateService();

            // Act
            var stats = await service.GetStats();

            // Assert
            stats.QueueSize.Should().Be(1);
            stats.ActionsToday.Should().Be(5);
            stats.ActionsThisWeek.Should().Be(5);
            stats.ActionsThisMonth.Should().Be(5);
        }

        // --- GetStats: QueueSize is NOT capped at the GetQueue pageSize limit (100) ---

        [Fact]
        public async Task GetStats_QueueSize_IsNotCappedAt100()
        {
            // Arrange: 101 distinct pending content items, one flag each
            var baseTime = new DateTime(2026, 1, 10, 0, 0, 0, DateTimeKind.Utc);
            var flags = new List<ContentFlagModel>();
            for (int id = 1; id <= 101; id++)
            {
                flags.Add(new ContentFlagModel
                {
                    Id = id,
                    ContentType = ModeratedContentType.Vulnerability,
                    ContentId = id,
                    FlaggedByUserId = 10,
                    Reason = FlagReason.Spam,
                    CreatedAt = baseTime.AddMinutes(id)
                });
            }
            _flagsMock.Setup(f => f.GetAll()).ReturnsAsync(flags);
            _actionsMock.Setup(a => a.GetAll()).ReturnsAsync(new List<ModerationActionModel>());

            // Target returns a non-null info for ANY content id
            _vulnTargetMock
                .Setup(t => t.Get(It.IsAny<int>()))
                .ReturnsAsync(new ModerationTargetInfo { Preview = "P", FullContent = "F", AuthorUserId = 1 });
            IModerationTarget outTarget = _vulnTargetMock.Object;
            _registryMock
                .Setup(r => r.TryGet(ModeratedContentType.Vulnerability, out outTarget))
                .Returns(true);

            // Author lookups return something for any id
            _loginProcessorMock
                .Setup(l => l.GetById(It.IsAny<int>()))
                .ReturnsAsync(new LoginModel { LoginId = 1, FullName = "Author", Email = "a@b.com" });
            _profileProcessorMock
                .Setup(p => p.GetByLoginIdAsync(It.IsAny<int>()))
                .ReturnsAsync(new UserProfileModel { LoginId = 1, ReputationScore = 50 });

            var service = CreateService();

            // Act
            var stats = await service.GetStats();

            // Assert: must NOT be capped at 100
            stats.QueueSize.Should().Be(101);
        }

        // --- GetQueue ModerationHistory is populated correctly ---

        [Fact]
        public async Task GetQueue_ModerationHistory_PopulatedFromActions()
        {
            // Arrange
            var flagTime = new DateTime(2026, 1, 5, 0, 0, 0, DateTimeKind.Utc);
            var action1Time = flagTime.AddHours(1);
            var action2Time = flagTime.AddHours(2);

            var flags = new List<ContentFlagModel>
            {
                new() { Id = 1, ContentType = ModeratedContentType.Vulnerability, ContentId = 1, FlaggedByUserId = 10, Reason = FlagReason.Spam, CreatedAt = flagTime }
            };
            var actions = new List<ModerationActionModel>
            {
                new() { Id = 10, ContentType = ModeratedContentType.Vulnerability, ContentId = 1, ModeratorId = 99, Action = ModerationActionType.Hide, Reason = "Policy", CreatedAt = action1Time },
                new() { Id = 11, ContentType = ModeratedContentType.Vulnerability, ContentId = 1, ModeratorId = 98, Action = ModerationActionType.Approve, CreatedAt = action2Time }
            };
            _flagsMock.Setup(f => f.GetAll()).ReturnsAsync(flags);
            _actionsMock.Setup(a => a.GetAll()).ReturnsAsync(actions);
            SetupVulnTarget(1, new ModerationTargetInfo { Preview = "P", FullContent = "F", AuthorUserId = 1 });

            // Moderators referenced by the actions resolve to names via the login lookup.
            _loginProcessorMock.Setup(l => l.GetById(99)).ReturnsAsync(new LoginModel { LoginId = 99, FullName = "Mod Ninetynine" });
            _loginProcessorMock.Setup(l => l.GetById(98)).ReturnsAsync(new LoginModel { LoginId = 98, FullName = "Mod Ninetyeight" });

            var service = CreateService();

            // Act
            var queue = await service.GetQueue(null, null, 1);

            // Assert
            queue.Should().HaveCount(1);
            var item = queue[0];
            item.ModerationHistory.Should().HaveCount(2);
            item.ModerationHistory[0].Id.Should().Be("10");
            item.ModerationHistory[0].Action.Should().Be("hidden");
            item.ModerationHistory[0].ModeratorName.Should().Be("Mod Ninetynine");
            item.ModerationHistory[1].Id.Should().Be("11");
            item.ModerationHistory[1].Action.Should().Be("approved");
            item.ModerationHistory[1].ModeratorName.Should().Be("Mod Ninetyeight");
            // Last action is Approve (newer than flag), status should be "approved"
            item.Status.Should().Be("approved");
        }

        // --- GetQueue: status filter works ---

        [Fact]
        public async Task GetQueue_StatusFilter_OnlyReturnsPendingItems()
        {
            // Arrange: two items, one pending, one hidden
            var baseTime = new DateTime(2026, 1, 10, 0, 0, 0, DateTimeKind.Utc);
            var flags = new List<ContentFlagModel>
            {
                // ContentId=1: pending (no action)
                new() { Id = 1, ContentType = ModeratedContentType.Vulnerability, ContentId = 1, FlaggedByUserId = 10, Reason = FlagReason.Spam, CreatedAt = baseTime },
                // ContentId=2: hidden (action before flag)
                new() { Id = 2, ContentType = ModeratedContentType.Vulnerability, ContentId = 2, FlaggedByUserId = 11, Reason = FlagReason.Spam, CreatedAt = baseTime }
            };
            var actions = new List<ModerationActionModel>
            {
                new() { Id = 5, ContentType = ModeratedContentType.Vulnerability, ContentId = 2, ModeratorId = 99, Action = ModerationActionType.Hide, CreatedAt = baseTime.AddHours(1) }
            };
            _flagsMock.Setup(f => f.GetAll()).ReturnsAsync(flags);
            _actionsMock.Setup(a => a.GetAll()).ReturnsAsync(actions);

            // Setup both targets
            _vulnTargetMock.Setup(t => t.Get(1)).ReturnsAsync(new ModerationTargetInfo { Preview = "P1", FullContent = "F1", AuthorUserId = 1 });
            _vulnTargetMock.Setup(t => t.Get(2)).ReturnsAsync(new ModerationTargetInfo { Preview = "P2", FullContent = "F2", AuthorUserId = 2 });
            IModerationTarget outTarget = _vulnTargetMock.Object;
            _registryMock.Setup(r => r.TryGet(ModeratedContentType.Vulnerability, out outTarget)).Returns(true);

            var service = CreateService();

            // Act
            var pendingQueue = await service.GetQueue("pending", null, 1);
            var hiddenQueue = await service.GetQueue("hidden", null, 1);

            // Assert
            pendingQueue.Should().HaveCount(1);
            pendingQueue[0].ContentId.Should().Be("1");

            hiddenQueue.Should().HaveCount(1);
            hiddenQueue[0].ContentId.Should().Be("2");
        }
    }
}

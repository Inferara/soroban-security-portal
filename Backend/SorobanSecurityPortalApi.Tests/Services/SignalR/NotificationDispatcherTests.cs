using Microsoft.AspNetCore.SignalR;
using SorobanSecurityPortalApi.Hubs;
using SorobanSecurityPortalApi.Services;

namespace SorobanSecurityPortalApi.Tests.Services.SignalR;

/// <summary>
/// Unit tests for NotificationDispatcher service.
/// Tests cover sending notifications to individual users, broadcasting to all clients,
/// cancellation token support, and proper hub context invocation.
/// </summary>
public class NotificationDispatcherTests
{
    private readonly Mock<IHubContext<NotificationHub>> _hubContextMock;
    private readonly Mock<IHubClients> _hubClientsMock;
    private readonly Mock<IClientProxy> _clientProxyMock;
    private readonly Mock<IClientProxy> _allClientProxyMock;

    public NotificationDispatcherTests()
    {
        _hubContextMock = new Mock<IHubContext<NotificationHub>>();
        _hubClientsMock = new Mock<IHubClients>();
        _clientProxyMock = new Mock<IClientProxy>();
        _allClientProxyMock = new Mock<IClientProxy>();

        // Setup the hub context mock chain
        _hubContextMock.Setup(x => x.Clients).Returns(_hubClientsMock.Object);
        _hubClientsMock.Setup(x => x.User(It.IsAny<string>())).Returns(_clientProxyMock.Object);
        _hubClientsMock.Setup(x => x.All).Returns(_allClientProxyMock.Object);
    }

    #region SendToUserAsync Tests

    [Fact]
    public async Task SendToUserAsync_WithValidUserId_SendsMessageToUser()
    {
        // Arrange
        const string userId = "user-123";
        const string method = "ReceiveNotification";
        var payload = new { message = "Hello", type = "info" };

        var sut = CreateDispatcher();

        // Act
        await sut.SendToUserAsync(userId, method, payload);

        // Assert
        _hubClientsMock.Verify(x => x.User(userId), Times.Once);
        _clientProxyMock.Verify(
            x => x.SendCoreAsync(method, It.Is<object[]>(args => args[0] == payload), default),
            Times.Once);
    }

    [Fact]
    public async Task SendToUserAsync_WithDifferentUserIds_SendsToCorrectUsers()
    {
        // Arrange
        const string userId1 = "user-001";
        const string userId2 = "user-002";
        const string method = "ReceiveMessage";
        var payload = new { content = "Test message" };

        var sut = CreateDispatcher();

        // Act
        await sut.SendToUserAsync(userId1, method, payload);
        await sut.SendToUserAsync(userId2, method, payload);

        // Assert
        _hubClientsMock.Verify(x => x.User(userId1), Times.Once);
        _hubClientsMock.Verify(x => x.User(userId2), Times.Once);
    }

    [Fact]
    public async Task SendToUserAsync_WithCancellationToken_PassesTokenToHub()
    {
        // Arrange
        const string userId = "user-123";
        const string method = "ReceiveAlert";
        var payload = new { alertType = "warning" };
        using var cts = new CancellationTokenSource();
        var token = cts.Token;

        var sut = CreateDispatcher();

        // Act
        await sut.SendToUserAsync(userId, method, payload, token);

        // Assert
        _clientProxyMock.Verify(
            x => x.SendCoreAsync(method, It.IsAny<object[]>(), token),
            Times.Once);
    }

    [Fact]
    public async Task SendToUserAsync_WithEmptyUserId_StillCallsHubContext()
    {
        // Arrange - Even with empty user ID, the dispatcher should pass through to hub
        const string userId = "";
        const string method = "TestMethod";
        var payload = new { test = true };

        var sut = CreateDispatcher();

        // Act
        await sut.SendToUserAsync(userId, method, payload);

        // Assert - Hub context is still called (SignalR handles empty user IDs)
        _hubClientsMock.Verify(x => x.User(userId), Times.Once);
    }

    [Fact]
    public async Task SendToUserAsync_WithComplexPayload_SerializesCorrectly()
    {
        // Arrange
        const string userId = "user-456";
        const string method = "ReceiveComplexData";
        var payload = new
        {
            id = Guid.NewGuid(),
            items = new[] { "item1", "item2", "item3" },
            metadata = new { count = 3, isValid = true }
        };

        var sut = CreateDispatcher();

        // Act
        await sut.SendToUserAsync(userId, method, payload);

        // Assert
        _clientProxyMock.Verify(
            x => x.SendCoreAsync(method, It.Is<object[]>(args => args[0] == payload), default),
            Times.Once);
    }

    [Theory]
    [InlineData("NewAudit")]
    [InlineData("VulnerabilityFound")]
    [InlineData("ReportGenerated")]
    [InlineData("SystemAlert")]
    public async Task SendToUserAsync_WithVariousMethods_SendsCorrectMethod(string method)
    {
        // Arrange
        const string userId = "user-999";
        var payload = new { data = "test" };

        var sut = CreateDispatcher();

        // Act
        await sut.SendToUserAsync(userId, method, payload);

        // Assert
        _clientProxyMock.Verify(
            x => x.SendCoreAsync(method, It.IsAny<object[]>(), default),
            Times.Once);
    }

    #endregion

    #region SendToAllAsync Tests

    [Fact]
    public async Task SendToAllAsync_WithValidPayload_BroadcastsToAllClients()
    {
        // Arrange
        const string method = "SystemBroadcast";
        var payload = new { announcement = "System maintenance scheduled" };

        var sut = CreateDispatcher();

        // Act
        await sut.SendToAllAsync(method, payload);

        // Assert
        _hubClientsMock.Verify(x => x.All, Times.Once);
        _allClientProxyMock.Verify(
            x => x.SendCoreAsync(method, It.Is<object[]>(args => args[0] == payload), default),
            Times.Once);
    }

    [Fact]
    public async Task SendToAllAsync_WithCancellationToken_PassesTokenToHub()
    {
        // Arrange
        const string method = "GlobalUpdate";
        var payload = new { version = "2.0.0" };
        using var cts = new CancellationTokenSource();
        var token = cts.Token;

        var sut = CreateDispatcher();

        // Act
        await sut.SendToAllAsync(method, payload, token);

        // Assert
        _allClientProxyMock.Verify(
            x => x.SendCoreAsync(method, It.IsAny<object[]>(), token),
            Times.Once);
    }

    [Fact]
    public async Task SendToAllAsync_MultipleBroadcasts_AllGoThrough()
    {
        // Arrange
        const string method1 = "Event1";
        const string method2 = "Event2";
        var payload1 = new { type = "first" };
        var payload2 = new { type = "second" };

        var sut = CreateDispatcher();

        // Act
        await sut.SendToAllAsync(method1, payload1);
        await sut.SendToAllAsync(method2, payload2);

        // Assert
        _allClientProxyMock.Verify(
            x => x.SendCoreAsync(method1, It.IsAny<object[]>(), default),
            Times.Once);
        _allClientProxyMock.Verify(
            x => x.SendCoreAsync(method2, It.IsAny<object[]>(), default),
            Times.Once);
    }

    [Fact]
    public async Task SendToAllAsync_WithNullPayload_SendsNullToClients()
    {
        // Arrange
        const string method = "NullNotification";
        object? payload = null;

        var sut = CreateDispatcher();

        // Act
        await sut.SendToAllAsync(method, payload!);

        // Assert
        _allClientProxyMock.Verify(
            x => x.SendCoreAsync(method, It.Is<object[]>(args => args[0] == null), default),
            Times.Once);
    }

    #endregion

    #region Cancellation Token Edge Cases

    [Fact]
    public async Task SendToUserAsync_WithDefaultCancellationToken_UsesDefaultToken()
    {
        // Arrange
        const string userId = "user-123";
        const string method = "TestMethod";
        var payload = new { test = true };

        var sut = CreateDispatcher();

        // Act - Call without explicit cancellation token
        await sut.SendToUserAsync(userId, method, payload);

        // Assert - Should use default token
        _clientProxyMock.Verify(
            x => x.SendCoreAsync(method, It.IsAny<object[]>(), default),
            Times.Once);
    }

    [Fact]
    public async Task SendToAllAsync_WithDefaultCancellationToken_UsesDefaultToken()
    {
        // Arrange
        const string method = "BroadcastMethod";
        var payload = new { broadcast = true };

        var sut = CreateDispatcher();

        // Act - Call without explicit cancellation token
        await sut.SendToAllAsync(method, payload);

        // Assert - Should use default token
        _allClientProxyMock.Verify(
            x => x.SendCoreAsync(method, It.IsAny<object[]>(), default),
            Times.Once);
    }

    #endregion

    #region Notification Payload Types

    [Fact]
    public async Task SendToUserAsync_WithAuditNotification_SendsCorrectPayload()
    {
        // Arrange
        const string userId = "auditor-001";
        const string method = "AuditCompleted";
        var payload = new
        {
            auditId = "audit-12345",
            projectName = "Smart Contract v2",
            vulnerabilitiesFound = 3,
            criticalCount = 1,
            completedAt = DateTime.UtcNow
        };

        var sut = CreateDispatcher();

        // Act
        await sut.SendToUserAsync(userId, method, payload);

        // Assert
        _clientProxyMock.Verify(
            x => x.SendCoreAsync(method, It.Is<object[]>(args => args[0] == payload), default),
            Times.Once);
    }

    [Fact]
    public async Task SendToAllAsync_WithSecurityAlert_BroadcastsCorrectly()
    {
        // Arrange
        const string method = "SecurityAlert";
        var payload = new
        {
            severity = "critical",
            title = "New vulnerability pattern detected",
            description = "A new reentrancy vulnerability pattern has been identified",
            timestamp = DateTime.UtcNow
        };

        var sut = CreateDispatcher();

        // Act
        await sut.SendToAllAsync(method, payload);

        // Assert
        _allClientProxyMock.Verify(
            x => x.SendCoreAsync(method, It.Is<object[]>(args => args[0] == payload), default),
            Times.Once);
    }

    #endregion

    #region Helper Methods

    private NotificationDispatcher CreateDispatcher()
    {
        return new NotificationDispatcher(_hubContextMock.Object);
    }

    #endregion
}

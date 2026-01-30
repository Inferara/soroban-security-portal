using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;
using SorobanSecurityPortalApi.Hubs;
using StackExchange.Redis;

namespace SorobanSecurityPortalApi.Tests.Services.SignalR;

/// <summary>
/// Unit tests for NotificationHub.
/// Tests cover connection lifecycle events, Redis connection tracking,
/// error handling, and logging behavior.
/// </summary>
public class NotificationHubTests
{
    private readonly Mock<IConnectionMultiplexer> _redisMock;
    private readonly Mock<IDatabase> _databaseMock;
    private readonly Mock<ILogger<NotificationHub>> _loggerMock;

    public NotificationHubTests()
    {
        _redisMock = new Mock<IConnectionMultiplexer>();
        _databaseMock = new Mock<IDatabase>();
        _loggerMock = new Mock<ILogger<NotificationHub>>();

        // Setup Redis mock to return database
        _redisMock.Setup(x => x.GetDatabase(It.IsAny<int>(), It.IsAny<object>()))
            .Returns(_databaseMock.Object);
    }

    #region Constructor Tests

    [Fact]
    public void Constructor_WithValidDependencies_CreatesInstance()
    {
        // Act
        var hub = CreateHub();

        // Assert
        hub.Should().NotBeNull();
    }

    #endregion

    #region OnConnectedAsync Tests

    [Fact]
    public async Task OnConnectedAsync_WithAuthenticatedUser_AddsConnectionToRedis()
    {
        // Arrange
        const string userId = "user-123";
        const string connectionId = "conn-456";
        
        var hub = CreateHubWithMockedContext(userId, connectionId);
        
        _databaseMock.Setup(x => x.SetAddAsync(
                It.IsAny<RedisKey>(),
                It.IsAny<RedisValue>(),
                It.IsAny<CommandFlags>()))
            .ReturnsAsync(true);

        // Act
        await hub.OnConnectedAsync();

        // Assert
        _databaseMock.Verify(
            x => x.SetAddAsync(
                $"user:{userId}:connections",
                connectionId,
                CommandFlags.None),
            Times.Once);
    }

    [Fact]
    public async Task OnConnectedAsync_WithAuthenticatedUser_LogsConnection()
    {
        // Arrange
        const string userId = "user-789";
        const string connectionId = "conn-xyz";
        
        var hub = CreateHubWithMockedContext(userId, connectionId);

        // Act
        await hub.OnConnectedAsync();

        // Assert - Verify logging occurred
        _loggerMock.Verify(
            x => x.Log(
                LogLevel.Information,
                It.IsAny<EventId>(),
                It.Is<It.IsAnyType>((o, t) => o.ToString()!.Contains("connected")),
                null,
                It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
            Times.Once);
    }

    [Fact]
    public async Task OnConnectedAsync_WithNoUserId_DoesNotTrackConnection()
    {
        // Arrange
        var hub = CreateHubWithMockedContext(null, "conn-123");

        // Act
        await hub.OnConnectedAsync();

        // Assert - Redis should not be called
        _databaseMock.Verify(
            x => x.SetAddAsync(It.IsAny<RedisKey>(), It.IsAny<RedisValue>(), It.IsAny<CommandFlags>()),
            Times.Never);
    }

    [Fact]
    public async Task OnConnectedAsync_WithEmptyUserId_DoesNotTrackConnection()
    {
        // Arrange
        var hub = CreateHubWithMockedContext("", "conn-123");

        // Act
        await hub.OnConnectedAsync();

        // Assert - Redis should not be called for empty user ID
        _databaseMock.Verify(
            x => x.SetAddAsync(It.IsAny<RedisKey>(), It.IsAny<RedisValue>(), It.IsAny<CommandFlags>()),
            Times.Never);
    }

    [Fact]
    public async Task OnConnectedAsync_WhenRedisThrows_LogsErrorAndContinues()
    {
        // Arrange
        const string userId = "user-error";
        const string connectionId = "conn-error";
        
        var hub = CreateHubWithMockedContext(userId, connectionId);
        
        _databaseMock.Setup(x => x.SetAddAsync(
                It.IsAny<RedisKey>(),
                It.IsAny<RedisValue>(),
                It.IsAny<CommandFlags>()))
            .ThrowsAsync(new RedisConnectionException(ConnectionFailureType.UnableToConnect, "Connection failed"));

        // Act - Should not throw
        var exception = await Record.ExceptionAsync(() => hub.OnConnectedAsync());

        // Assert - No exception should propagate
        exception.Should().BeNull();
        
        // Verify error was logged
        _loggerMock.Verify(
            x => x.Log(
                LogLevel.Error,
                It.IsAny<EventId>(),
                It.Is<It.IsAnyType>((o, t) => o.ToString()!.Contains("Error tracking connection")),
                It.IsAny<Exception>(),
                It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
            Times.Once);
    }

    #endregion

    #region OnDisconnectedAsync Tests

    [Fact]
    public async Task OnDisconnectedAsync_WithAuthenticatedUser_RemovesConnectionFromRedis()
    {
        // Arrange
        const string userId = "user-disconnect";
        const string connectionId = "conn-disconnect";
        
        var hub = CreateHubWithMockedContext(userId, connectionId);
        
        _databaseMock.Setup(x => x.SetRemoveAsync(
                It.IsAny<RedisKey>(),
                It.IsAny<RedisValue>(),
                It.IsAny<CommandFlags>()))
            .ReturnsAsync(true);

        // Act
        await hub.OnDisconnectedAsync(null);

        // Assert
        _databaseMock.Verify(
            x => x.SetRemoveAsync(
                $"user:{userId}:connections",
                connectionId,
                CommandFlags.None),
            Times.Once);
    }

    [Fact]
    public async Task OnDisconnectedAsync_WithException_RemovesConnectionAndContinues()
    {
        // Arrange
        const string userId = "user-with-error";
        const string connectionId = "conn-with-error";
        var disconnectException = new Exception("Client disconnected unexpectedly");
        
        var hub = CreateHubWithMockedContext(userId, connectionId);

        // Act
        await hub.OnDisconnectedAsync(disconnectException);

        // Assert - Should still remove connection
        _databaseMock.Verify(
            x => x.SetRemoveAsync(
                $"user:{userId}:connections",
                connectionId,
                CommandFlags.None),
            Times.Once);
    }

    [Fact]
    public async Task OnDisconnectedAsync_WithNoUserId_DoesNotRemoveFromRedis()
    {
        // Arrange
        var hub = CreateHubWithMockedContext(null, "conn-123");

        // Act
        await hub.OnDisconnectedAsync(null);

        // Assert - Redis should not be called
        _databaseMock.Verify(
            x => x.SetRemoveAsync(It.IsAny<RedisKey>(), It.IsAny<RedisValue>(), It.IsAny<CommandFlags>()),
            Times.Never);
    }

    [Fact]
    public async Task OnDisconnectedAsync_WhenRedisThrows_LogsErrorAndContinues()
    {
        // Arrange
        const string userId = "user-redis-error";
        const string connectionId = "conn-redis-error";
        
        var hub = CreateHubWithMockedContext(userId, connectionId);
        
        _databaseMock.Setup(x => x.SetRemoveAsync(
                It.IsAny<RedisKey>(),
                It.IsAny<RedisValue>(),
                It.IsAny<CommandFlags>()))
            .ThrowsAsync(new RedisTimeoutException("Timeout", CommandStatus.Unknown));

        // Act - Should not throw
        var exception = await Record.ExceptionAsync(() => hub.OnDisconnectedAsync(null));

        // Assert - No exception should propagate
        exception.Should().BeNull();
        
        // Verify error was logged
        _loggerMock.Verify(
            x => x.Log(
                LogLevel.Error,
                It.IsAny<EventId>(),
                It.Is<It.IsAnyType>((o, t) => o.ToString()!.Contains("Error removing connection tracking")),
                It.IsAny<Exception>(),
                It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
            Times.Once);
    }

    [Fact]
    public async Task OnDisconnectedAsync_WithAuthenticatedUser_LogsDisconnection()
    {
        // Arrange
        const string userId = "user-log-disconnect";
        const string connectionId = "conn-log";
        
        var hub = CreateHubWithMockedContext(userId, connectionId);

        // Act
        await hub.OnDisconnectedAsync(null);

        // Assert - Verify logging occurred
        _loggerMock.Verify(
            x => x.Log(
                LogLevel.Information,
                It.IsAny<EventId>(),
                It.Is<It.IsAnyType>((o, t) => o.ToString()!.Contains("disconnected")),
                null,
                It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
            Times.Once);
    }

    #endregion

    #region Redis Key Format Tests

    [Theory]
    [InlineData("user-001", "user:user-001:connections")]
    [InlineData("abc123", "user:abc123:connections")]
    [InlineData("admin@example.com", "user:admin@example.com:connections")]
    public async Task OnConnectedAsync_UsesCorrectRedisKeyFormat(string userId, string expectedKey)
    {
        // Arrange
        var hub = CreateHubWithMockedContext(userId, "conn-123");
        RedisKey? capturedKey = null;
        
        _databaseMock.Setup(x => x.SetAddAsync(
                It.IsAny<RedisKey>(),
                It.IsAny<RedisValue>(),
                It.IsAny<CommandFlags>()))
            .Callback<RedisKey, RedisValue, CommandFlags>((key, _, _) => capturedKey = key)
            .ReturnsAsync(true);

        // Act
        await hub.OnConnectedAsync();

        // Assert
        capturedKey.Should().NotBeNull();
        capturedKey.ToString().Should().Be(expectedKey);
    }

    #endregion

    #region Multiple Connections Tests

    [Fact]
    public async Task OnConnectedAsync_MultipleConnectionsSameUser_TracksAllConnections()
    {
        // Arrange
        const string userId = "user-multi";
        var connectionIds = new[] { "conn-1", "conn-2", "conn-3" };

        foreach (var connectionId in connectionIds)
        {
            var hub = CreateHubWithMockedContext(userId, connectionId);
            
            // Act
            await hub.OnConnectedAsync();
        }

        // Assert - Each connection should be tracked
        _databaseMock.Verify(
            x => x.SetAddAsync(
                $"user:{userId}:connections",
                It.IsAny<RedisValue>(),
                CommandFlags.None),
            Times.Exactly(3));
    }

    #endregion

    #region Helper Methods

    private NotificationHub CreateHub()
    {
        return new NotificationHub(_redisMock.Object, _loggerMock.Object);
    }

    private NotificationHub CreateHubWithMockedContext(string? userId, string connectionId)
    {
        var hub = CreateHub();
        
        // Create mock HubCallerContext
        var contextMock = new Mock<HubCallerContext>();
        contextMock.Setup(x => x.UserIdentifier).Returns(userId);
        contextMock.Setup(x => x.ConnectionId).Returns(connectionId);
        
        // Use reflection to set the Context property (it's normally set by SignalR infrastructure)
        var contextProperty = typeof(Hub).GetProperty("Context");
        contextProperty?.SetValue(hub, contextMock.Object);

        return hub;
    }

    #endregion
}

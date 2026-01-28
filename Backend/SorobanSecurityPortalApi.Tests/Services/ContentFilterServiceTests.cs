using Microsoft.Extensions.Logging;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Services.ControllersServices;

namespace SorobanSecurityPortalApi.Tests.Services;

public class ContentFilterServiceTests
{
    private readonly Mock<ICacheAccessor> _cacheAccessorMock;
    private readonly Mock<IModerationLogProcessor> _moderationLogProcessorMock;
    private readonly Mock<IExtendedConfig> _extendedConfigMock;
    private readonly Mock<ILogger<ContentFilterService>> _loggerMock;

    public ContentFilterServiceTests()
    {
        _cacheAccessorMock = new Mock<ICacheAccessor>();
        _moderationLogProcessorMock = new Mock<IModerationLogProcessor>();
        _extendedConfigMock = new Mock<IExtendedConfig>();
        _loggerMock = new Mock<ILogger<ContentFilterService>>();
    }

    #region Markdown to HTML Conversion Tests

    [Fact]
    public async Task FilterContentAsync_ConvertsMarkdownToHtml()
    {
        // Arrange
        SetupDefaultConfig();
        var service = CreateService();
        var markdown = "**Bold** and *italic* text";

        // Act
        var result = await service.FilterContentAsync(markdown, 1);

        // Assert
        result.SanitizedContent.Should().Contain("<strong>Bold</strong>");
        result.SanitizedContent.Should().Contain("<em>italic</em>");
    }

    [Fact]
    public async Task FilterContentAsync_ConvertsMarkdownCodeBlocks()
    {
        // Arrange
        SetupDefaultConfig();
        var service = CreateService();
        var markdown = "```\ncode here\n```";

        // Act
        var result = await service.FilterContentAsync(markdown, 1);

        // Assert
        result.SanitizedContent.Should().Contain("<pre><code>");
        result.SanitizedContent.Should().Contain("code here");
    }

    [Fact]
    public async Task FilterContentAsync_ConvertsMarkdownLinks()
    {
        // Arrange
        SetupDefaultConfig();
        var service = CreateService();
        var markdown = "[GitHub](https://github.com)";

        // Act
        var result = await service.FilterContentAsync(markdown, 1);

        // Assert
        result.SanitizedContent.Should().Contain("<a");
        result.SanitizedContent.Should().Contain("href=\"https://github.com\"");
    }

    #endregion

    #region HTML Sanitization Tests

    [Fact]
    public async Task FilterContentAsync_RemovesScriptTags()
    {
        // Arrange
        SetupDefaultConfig();
        var service = CreateService();
        var content = "<script>alert('xss')</script>Safe content";

        // Act
        var result = await service.FilterContentAsync(content, 1);

        // Assert
        result.SanitizedContent.Should().NotContain("<script>");
        result.SanitizedContent.Should().NotContain("alert");
    }

    [Fact]
    public async Task FilterContentAsync_RemovesOnClickEvents()
    {
        // Arrange
        SetupDefaultConfig();
        var service = CreateService();
        var content = "<div onclick='alert(1)'>Click me</div>";

        // Act
        var result = await service.FilterContentAsync(content, 1);

        // Assert
        result.SanitizedContent.Should().NotContain("onclick");
    }

    [Fact]
    public async Task FilterContentAsync_AllowsWhitelistedTags()
    {
        // Arrange
        SetupDefaultConfig();
        var service = CreateService();
        var content = "<p>Paragraph</p><strong>Bold</strong><em>Italic</em><code>Code</code>";

        // Act
        var result = await service.FilterContentAsync(content, 1);

        // Assert
        result.SanitizedContent.Should().Contain("<p>");
        result.SanitizedContent.Should().Contain("<strong>");
        result.SanitizedContent.Should().Contain("<em>");
        result.SanitizedContent.Should().Contain("<code>");
    }

    [Fact]
    public async Task FilterContentAsync_RemovesNonWhitelistedTags()
    {
        // Arrange
        SetupDefaultConfig();
        var service = CreateService();
        var content = "<div>Content</div><iframe src='evil.com'></iframe>";

        // Act
        var result = await service.FilterContentAsync(content, 1);

        // Assert
        result.SanitizedContent.Should().NotContain("<iframe>");
        result.SanitizedContent.Should().NotContain("evil.com");
    }

    #endregion

    #region Empty Content Tests

    [Fact]
    public async Task FilterContentAsync_BlocksEmptyContent()
    {
        // Arrange
        SetupDefaultConfig();
        var service = CreateService();

        // Act
        var result = await service.FilterContentAsync("", 1);

        // Assert
        result.IsBlocked.Should().BeTrue();
        result.Warnings.Should().Contain("Content cannot be empty");
    }

    [Fact]
    public async Task FilterContentAsync_BlocksWhitespaceOnlyContent()
    {
        // Arrange
        SetupDefaultConfig();
        var service = CreateService();

        // Act
        var result = await service.FilterContentAsync("   \n\t  ", 1);

        // Assert
        result.IsBlocked.Should().BeTrue();
        result.Warnings.Should().Contain("Content cannot be empty");
    }

    #endregion

    #region Spam Detection Tests

    [Fact]
    public async Task FilterContentAsync_BlocksDuplicateContent()
    {
        // Arrange
        SetupDefaultConfig();
        _moderationLogProcessorMock
            .Setup(x => x.HasDuplicateContent(1, "duplicate content", TimeSpan.FromHours(24)))
            .ReturnsAsync(true);
        var service = CreateService();

        // Act
        var result = await service.FilterContentAsync("duplicate content", 1);

        // Assert
        result.IsBlocked.Should().BeTrue();
        result.Warnings.Should().Contain(w => w.Contains("Duplicate content"));
    }

    [Fact]
    public async Task FilterContentAsync_AllowsNewContent()
    {
        // Arrange
        SetupDefaultConfig();
        _moderationLogProcessorMock
            .Setup(x => x.HasDuplicateContent(It.IsAny<int>(), It.IsAny<string>(), It.IsAny<TimeSpan>()))
            .ReturnsAsync(false);
        var service = CreateService();

        // Act
        var result = await service.FilterContentAsync("new content", 1);

        // Assert
        result.IsBlocked.Should().BeFalse();
    }

    #endregion

    #region Profanity Filter Tests

    [Fact]
    public async Task FilterContentAsync_FlagsProfanityWhenEnabled()
    {
        // Arrange
        SetupConfigWithProfanity(enabled: true, words: new List<string> { "badword", "offensive" });
        var service = CreateService();

        // Act
        var result = await service.FilterContentAsync("This contains badword", 1);

        // Assert
        result.RequiresModeration.Should().BeTrue();
        result.Warnings.Should().Contain(w => w.Contains("Profanity detected"));
    }

    [Fact]
    public async Task FilterContentAsync_IsCaseInsensitiveForProfanity()
    {
        // Arrange
        SetupConfigWithProfanity(enabled: true, words: new List<string> { "badword" });
        var service = CreateService();

        // Act
        var result = await service.FilterContentAsync("This contains BADWORD", 1);

        // Assert
        result.RequiresModeration.Should().BeTrue();
        result.Warnings.Should().Contain(w => w.Contains("Profanity detected"));
    }

    [Fact]
    public async Task FilterContentAsync_IgnoresProfanityWhenDisabled()
    {
        // Arrange
        SetupConfigWithProfanity(enabled: false, words: new List<string> { "badword" });
        var service = CreateService();

        // Act
        var result = await service.FilterContentAsync("This contains badword", 1);

        // Assert
        result.RequiresModeration.Should().BeFalse();
        result.Warnings.Should().NotContain(w => w.Contains("Profanity detected"));
    }

    #endregion

    #region Link Flooding Tests

    [Fact]
    public async Task FilterContentAsync_AllowsLimitedLinks()
    {
        // Arrange
        SetupDefaultConfig();
        var service = CreateService();
        var content = "[Link1](https://github.com) [Link2](https://stellar.org)";

        // Act
        var result = await service.FilterContentAsync(content, 1);

        // Assert
        result.IsBlocked.Should().BeFalse();
    }

    [Fact]
    public async Task FilterContentAsync_BlocksExcessiveLinks()
    {
        // Arrange
        SetupDefaultConfig();
        var service = CreateService();
        var content = string.Join(" ", Enumerable.Range(1, 10).Select(i => $"[Link{i}](https://example{i}.com)"));

        // Act
        var result = await service.FilterContentAsync(content, 1);

        // Assert
        result.IsBlocked.Should().BeTrue();
        result.Warnings.Should().Contain(w => w.Contains("Too many links"));
    }

    #endregion

    #region URL Validation Tests

    [Fact]
    public async Task FilterContentAsync_AllowsTrustedDomains()
    {
        // Arrange
        SetupConfigWithTrustedDomains(new List<string> { "github.com", "stellar.org" });
        var service = CreateService();
        var content = "[GitHub](https://github.com/stellar)";

        // Act
        var result = await service.FilterContentAsync(content, 1);

        // Assert
        result.RequiresModeration.Should().BeFalse();
        result.IsBlocked.Should().BeFalse();
    }

    [Fact]
    public async Task FilterContentAsync_FlagsUntrustedDomains()
    {
        // Arrange
        SetupConfigWithTrustedDomains(new List<string> { "github.com" });
        var service = CreateService();
        var content = "[Suspicious](https://untrusted-site.com)";

        // Act
        var result = await service.FilterContentAsync(content, 1);

        // Assert
        result.RequiresModeration.Should().BeTrue();
        result.Warnings.Should().Contain(w => w.Contains("Untrusted domain"));
    }

    [Fact]
    public async Task FilterContentAsync_BlocksNonHttpsUrls()
    {
        // Arrange
        SetupDefaultConfig();
        var service = CreateService();
        var content = "[FTP Link](ftp://files.example.com)";

        // Act
        var result = await service.FilterContentAsync(content, 1);

        // Assert
        result.IsBlocked.Should().BeTrue();
        result.Warnings.Should().Contain(w => w.Contains("Non-HTTP(S) URL"));
    }

    [Fact]
    public async Task FilterContentAsync_FlagsInvalidUrls()
    {
        // Arrange
        SetupDefaultConfig();
        var service = CreateService();
        var content = "[Bad Link](not a valid url)";

        // Act
        var result = await service.FilterContentAsync(content, 1);

        // Assert
        result.RequiresModeration.Should().BeTrue();
        result.Warnings.Should().Contain(w => w.Contains("Invalid URL"));
    }

    [Fact]
    public async Task FilterContentAsync_AllowsSubdomainsOfTrustedDomains()
    {
        // Arrange
        SetupConfigWithTrustedDomains(new List<string> { "stellar.org" });
        var service = CreateService();
        var content = "[Docs](https://docs.stellar.org)";

        // Act
        var result = await service.FilterContentAsync(content, 1);

        // Assert
        result.RequiresModeration.Should().BeFalse();
    }

    #endregion

    #region Rate Limiting Tests

    [Fact]
    public async Task CheckRateLimitAsync_AllowsFirstRequest()
    {
        // Arrange
        _cacheAccessorMock.Setup(x => x.GetCacheValue(It.IsAny<string>())).Returns(string.Empty);
        var service = CreateService();

        // Act
        var result = await service.CheckRateLimitAsync(1);

        // Assert
        result.Should().BeTrue();
        _cacheAccessorMock.Verify(x => x.SetCacheValue(It.IsAny<string>(), "1", 60), Times.Once);
    }

    [Fact]
    public async Task CheckRateLimitAsync_AllowsRequestsUnderLimit()
    {
        // Arrange
        _cacheAccessorMock.Setup(x => x.GetCacheValue(It.IsAny<string>())).Returns("5");
        var service = CreateService();

        // Act
        var result = await service.CheckRateLimitAsync(1);

        // Assert
        result.Should().BeTrue();
        _cacheAccessorMock.Verify(x => x.SetCacheValue(It.IsAny<string>(), "6", 60), Times.Once);
    }

    [Fact]
    public async Task CheckRateLimitAsync_BlocksRequestsOverLimit()
    {
        // Arrange
        _cacheAccessorMock.Setup(x => x.GetCacheValue(It.IsAny<string>())).Returns("10");
        var service = CreateService();

        // Act
        var result = await service.CheckRateLimitAsync(1);

        // Assert
        result.Should().BeFalse();
    }

    [Fact]
    public async Task CheckRateLimitAsync_HandlesInvalidCacheValue()
    {
        // Arrange
        _cacheAccessorMock.Setup(x => x.GetCacheValue(It.IsAny<string>())).Returns("invalid");
        var service = CreateService();

        // Act
        var result = await service.CheckRateLimitAsync(1);

        // Assert
        result.Should().BeTrue();
        _cacheAccessorMock.Verify(x => x.SetCacheValue(It.IsAny<string>(), "1", 60), Times.Once);
    }

    #endregion

    #region Moderation Logging Tests

    [Fact]
    public async Task FilterContentAsync_LogsBlockedContent()
    {
        // Arrange
        SetupDefaultConfig();
        var service = CreateService();
        var capturedLog = new List<ModerationLogModel>();
        _moderationLogProcessorMock
            .Setup(x => x.Add(It.IsAny<ModerationLogModel>()))
            .Callback<ModerationLogModel>(log => capturedLog.Add(log))
            .Returns(Task.CompletedTask);

        // Act
        await service.FilterContentAsync("", 1);

        // Assert
        capturedLog.Should().HaveCount(1);
        capturedLog[0].IsBlocked.Should().BeTrue();
        capturedLog[0].UserId.Should().Be(1);
    }

    [Fact]
    public async Task FilterContentAsync_LogsModeratedContent()
    {
        // Arrange
        SetupConfigWithProfanity(enabled: true, words: new List<string> { "badword" });
        var service = CreateService();
        var capturedLog = new List<ModerationLogModel>();
        _moderationLogProcessorMock
            .Setup(x => x.Add(It.IsAny<ModerationLogModel>()))
            .Callback<ModerationLogModel>(log => capturedLog.Add(log))
            .Returns(Task.CompletedTask);

        // Act
        await service.FilterContentAsync("This has badword", 1);

        // Assert
        capturedLog.Should().HaveCount(1);
        capturedLog[0].RequiresModeration.Should().BeTrue();
        capturedLog[0].Warnings.Should().Contain("Profanity");
    }

    [Fact]
    public async Task FilterContentAsync_DoesNotLogCleanContent()
    {
        // Arrange
        SetupDefaultConfig();
        var service = CreateService();

        // Act
        await service.FilterContentAsync("Clean content", 1);

        // Assert
        _moderationLogProcessorMock.Verify(x => x.Add(It.IsAny<ModerationLogModel>()), Times.Never);
    }

    #endregion

    #region Integration Tests

    [Fact]
    public async Task FilterContentAsync_CompleteWorkflow_WithMarkdownAndLinks()
    {
        // Arrange
        SetupConfigWithTrustedDomains(new List<string> { "github.com" });
        var service = CreateService();
        var markdown = "Check out **this link**: [GitHub](https://github.com/stellar)";

        // Act
        var result = await service.FilterContentAsync(markdown, 1);

        // Assert
        result.IsBlocked.Should().BeFalse();
        result.RequiresModeration.Should().BeFalse();
        result.SanitizedContent.Should().Contain("<strong>");
        result.SanitizedContent.Should().Contain("href");
    }

    [Fact]
    public async Task FilterContentAsync_BlocksMultipleViolations()
    {
        // Arrange
        SetupConfigWithProfanity(enabled: true, words: new List<string> { "badword" });
        _moderationLogProcessorMock
            .Setup(x => x.HasDuplicateContent(It.IsAny<int>(), It.IsAny<string>(), It.IsAny<TimeSpan>()))
            .ReturnsAsync(true);
        var service = CreateService();

        // Act
        var result = await service.FilterContentAsync("badword duplicate", 1);

        // Assert
        result.IsBlocked.Should().BeTrue();
        result.RequiresModeration.Should().BeTrue();
        result.Warnings.Should().HaveCountGreaterThan(1);
    }

    #endregion

    #region Helper Methods

    private ContentFilterService CreateService()
    {
        return new ContentFilterService(
            _cacheAccessorMock.Object,
            _moderationLogProcessorMock.Object,
            _extendedConfigMock.Object,
            _loggerMock.Object);
    }

    private void SetupDefaultConfig()
    {
        _extendedConfigMock.Setup(x => x.ProfanityFilterEnabled).Returns(false);
        _extendedConfigMock.Setup(x => x.ProfanityWords).Returns(new List<string>());
        _extendedConfigMock.Setup(x => x.TrustedDomains).Returns(new List<string>());
        _moderationLogProcessorMock
            .Setup(x => x.HasDuplicateContent(It.IsAny<int>(), It.IsAny<string>(), It.IsAny<TimeSpan>()))
            .ReturnsAsync(false);
    }

    private void SetupConfigWithProfanity(bool enabled, List<string> words)
    {
        _extendedConfigMock.Setup(x => x.ProfanityFilterEnabled).Returns(enabled);
        _extendedConfigMock.Setup(x => x.ProfanityWords).Returns(words);
        _extendedConfigMock.Setup(x => x.TrustedDomains).Returns(new List<string>());
        _moderationLogProcessorMock
            .Setup(x => x.HasDuplicateContent(It.IsAny<int>(), It.IsAny<string>(), It.IsAny<TimeSpan>()))
            .ReturnsAsync(false);
    }

    private void SetupConfigWithTrustedDomains(List<string> domains)
    {
        _extendedConfigMock.Setup(x => x.ProfanityFilterEnabled).Returns(false);
        _extendedConfigMock.Setup(x => x.ProfanityWords).Returns(new List<string>());
        _extendedConfigMock.Setup(x => x.TrustedDomains).Returns(domains);
        _moderationLogProcessorMock
            .Setup(x => x.HasDuplicateContent(It.IsAny<int>(), It.IsAny<string>(), It.IsAny<TimeSpan>()))
            .ReturnsAsync(false);
    }

    #endregion
}

using FluentAssertions;
using SorobanSecurityPortalApi.Common;
using Xunit;

namespace SorobanSecurityPortalApi.Tests.Common
{
    public class BotUserAgentTests
    {
        [Theory]
        [InlineData("Mozilla/5.0 (compatible; Twitterbot/1.0)")]
        [InlineData("facebookexternalhit/1.1")]
        [InlineData("LinkedInBot/1.0")]
        [InlineData("TelegramBot (like TwitterBot)")]
        [InlineData("Mozilla/5.0 (compatible; bingbot/2.0)")]
        [InlineData("some-generic-crawler/2.0")]
        public void IsBot_TrueForKnownBots(string ua) => BotUserAgent.IsBot(ua).Should().BeTrue();

        [Theory]
        [InlineData("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36")]
        [InlineData("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605 Safari/604")]
        public void IsBot_FalseForRealBrowsers(string ua) => BotUserAgent.IsBot(ua).Should().BeFalse();

        [Fact]
        public void IsBot_TrueForEmptyOrNull()
        {
            BotUserAgent.IsBot(null).Should().BeTrue();
            BotUserAgent.IsBot("").Should().BeTrue();
        }
    }
}

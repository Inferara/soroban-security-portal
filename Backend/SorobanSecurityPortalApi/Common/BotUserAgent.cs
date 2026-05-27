using System;

namespace SorobanSecurityPortalApi.Common
{
    // Server-side backstop for the crawler User-Agents the UI nginx already diverts to OgController.
    // Used to classify a recorded view as Human vs Crawler so bots never inflate human counts.
    public static class BotUserAgent
    {
        private static readonly string[] Tokens =
        {
            // Same social/link-preview crawlers nginx routes to /__og:
            "facebookexternalhit", "Facebot", "Twitterbot", "LinkedInBot", "Slackbot",
            "Slack-ImgProxy", "TelegramBot", "Discordbot", "WhatsApp", "Pinterest",
            "redditbot", "Embedly", "vkShare", "SkypeUriPreview", "nuzzel", "Applebot", "bingbot",
            // Generic crawler markers as a backstop:
            "bot", "crawler", "spider", "crawl"
        };

        public static bool IsBot(string? userAgent)
        {
            if (string.IsNullOrWhiteSpace(userAgent)) return true; // no UA → not a real browser visit
            foreach (var token in Tokens)
                if (userAgent.Contains(token, StringComparison.OrdinalIgnoreCase))
                    return true;
            return false;
        }
    }
}

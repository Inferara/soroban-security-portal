using Ganss.Xss;
using Markdig;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;
using System.Text.RegularExpressions;

namespace SorobanSecurityPortalApi.Services.ControllersServices
{
    public class ContentFilterService : IContentFilterService
    {
        private readonly IHtmlSanitizer _sanitizer;
        private readonly ICacheAccessor _cacheAccessor;
        private readonly IModerationLogProcessor _moderationLogProcessor;
        private readonly IExtendedConfig _config;
        private readonly ILogger<ContentFilterService> _logger;

        private static readonly string[] AllowedTags = { "p", "br", "strong", "em", "code", "pre", "a", "ul", "ol", "li", "blockquote" };
        private const int MaxLinksAllowed = 5;
        private const int RateLimitPerMinute = 10;
        private const string RateLimitKeyPrefix = "content_filter_rate_limit:";

        public ContentFilterService(
            ICacheAccessor cacheAccessor,
            IModerationLogProcessor moderationLogProcessor,
            IExtendedConfig config,
            ILogger<ContentFilterService> logger)
        {
            _cacheAccessor = cacheAccessor;
            _moderationLogProcessor = moderationLogProcessor;
            _config = config;
            _logger = logger;

            _sanitizer = new HtmlSanitizer();
            ConfigureSanitizer();
        }

        private void ConfigureSanitizer()
        {
            _sanitizer.AllowedTags.Clear();
            foreach (var tag in AllowedTags)
            {
                _sanitizer.AllowedTags.Add(tag);
            }

            _sanitizer.AllowedAttributes.Clear();
            _sanitizer.AllowedAttributes.Add("href");
            _sanitizer.AllowedAttributes.Add("class");

            _sanitizer.AllowedSchemes.Clear();
            _sanitizer.AllowedSchemes.Add("http");
            _sanitizer.AllowedSchemes.Add("https");

            _sanitizer.RemovingAttribute += (sender, args) =>
            {
                if (args.Attribute.Name.StartsWith("on", StringComparison.OrdinalIgnoreCase))
                {
                    args.Cancel = false;
                    _logger.LogWarning("Removed dangerous attribute: {AttributeName}", args.Attribute.Name);
                }
            };
        }

        public async Task<ContentFilterResult> FilterContentAsync(string content, int userId)
        {
            var result = new ContentFilterResult();
            var originalContent = content;

            if (string.IsNullOrWhiteSpace(content))
            {
                result.IsBlocked = true;
                result.Warnings.Add("Content cannot be empty");
                await LogModerationAsync(userId, originalContent, "", "Empty content", result);
                return result;
            }

            var markdownHtml = Markdown.ToHtml(content, new MarkdownPipelineBuilder().UseAdvancedExtensions().Build());

            var sanitizedHtml = _sanitizer.Sanitize(markdownHtml);

            result.SanitizedContent = sanitizedHtml;

            await CheckSpamAsync(result, userId, originalContent);

            CheckProfanity(result, originalContent);

            CheckLinkFlooding(result, sanitizedHtml);

            ValidateUrls(result, sanitizedHtml);

            if (result.IsBlocked || result.RequiresModeration)
            {
                await LogModerationAsync(userId, originalContent, sanitizedHtml, string.Join("; ", result.Warnings), result);
            }

            return result;
        }

        private async Task CheckSpamAsync(ContentFilterResult result, int userId, string content)
        {
            var hasDuplicate = await _moderationLogProcessor.HasDuplicateContent(userId, content, TimeSpan.FromHours(24));
            if (hasDuplicate)
            {
                result.IsBlocked = true;
                result.Warnings.Add("Duplicate content detected within 24 hours");
                _logger.LogWarning("Spam detected: Duplicate content from user {UserId}", userId);
            }
        }

        private void CheckProfanity(ContentFilterResult result, string content)
        {
            if (_config.ProfanityFilterEnabled && _config.ProfanityWords.Count > 0)
            {
                var lowerContent = content.ToLowerInvariant();
                var foundProfanity = _config.ProfanityWords
                    .Where(word => lowerContent.Contains(word.ToLowerInvariant()))
                    .ToList();

                if (foundProfanity.Any())
                {
                    result.RequiresModeration = true;
                    result.Warnings.Add($"Profanity detected: {string.Join(", ", foundProfanity)}");
                    _logger.LogWarning("Profanity detected in content from user");
                }
            }
        }

        private void CheckLinkFlooding(ContentFilterResult result, string html)
        {
            var linkMatches = Regex.Matches(html, @"<a\s+[^>]*href\s*=\s*[""']([^""']*)[""'][^>]*>", RegexOptions.IgnoreCase);
            if (linkMatches.Count > MaxLinksAllowed)
            {
                result.IsBlocked = true;
                result.Warnings.Add($"Too many links detected: {linkMatches.Count} (max: {MaxLinksAllowed})");
                _logger.LogWarning("Link flooding detected: {LinkCount} links", linkMatches.Count);
            }
        }

        private void ValidateUrls(ContentFilterResult result, string html)
        {
            var linkMatches = Regex.Matches(html, @"<a\s+[^>]*href\s*=\s*[""']([^""']*)[""'][^>]*>", RegexOptions.IgnoreCase);
            var trustedDomains = _config.TrustedDomains;

            foreach (Match match in linkMatches)
            {
                if (match.Groups.Count > 1)
                {
                    var url = match.Groups[1].Value;
                    if (!string.IsNullOrWhiteSpace(url))
                    {
                        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri))
                        {
                            result.RequiresModeration = true;
                            result.Warnings.Add($"Invalid URL detected: {url}");
                            continue;
                        }

                        if (uri.Scheme != "http" && uri.Scheme != "https")
                        {
                            result.IsBlocked = true;
                            result.Warnings.Add($"Non-HTTP(S) URL detected: {url}");
                            continue;
                        }

                        if (trustedDomains.Count > 0)
                        {
                            var isDomainTrusted = trustedDomains.Any(domain =>
                                uri.Host.Equals(domain, StringComparison.OrdinalIgnoreCase) ||
                                uri.Host.EndsWith($".{domain}", StringComparison.OrdinalIgnoreCase));

                            if (!isDomainTrusted)
                            {
                                result.RequiresModeration = true;
                                result.Warnings.Add($"Untrusted domain detected: {uri.Host}");
                            }
                        }
                    }
                }
            }
        }

        public async Task<bool> CheckRateLimitAsync(int userId)
        {
            var cacheKey = $"{RateLimitKeyPrefix}{userId}";
            var currentCount = _cacheAccessor.GetCacheValue(cacheKey);

            if (string.IsNullOrEmpty(currentCount))
            {
                _cacheAccessor.SetCacheValue(cacheKey, "1", 60);
                return true;
            }

            if (int.TryParse(currentCount, out var count))
            {
                if (count >= RateLimitPerMinute)
                {
                    _logger.LogWarning("Rate limit exceeded for user {UserId}: {Count} attempts", userId, count);
                    return false;
                }

                _cacheAccessor.SetCacheValue(cacheKey, (count + 1).ToString(), 60);
                return true;
            }

            _cacheAccessor.SetCacheValue(cacheKey, "1", 60);
            return true;
        }

        private async Task LogModerationAsync(int userId, string originalContent, string sanitizedContent, string reason, ContentFilterResult result)
        {
            try
            {
                var log = new ModerationLogModel
                {
                    UserId = userId,
                    OriginalContent = originalContent,
                    SanitizedContent = sanitizedContent,
                    FilterReason = reason,
                    IsBlocked = result.IsBlocked,
                    RequiresModeration = result.RequiresModeration,
                    Warnings = string.Join("; ", result.Warnings),
                    CreatedAt = DateTime.UtcNow
                };

                await _moderationLogProcessor.Add(log);
                _logger.LogInformation("Moderation log created for user {UserId}: {Reason}", userId, reason);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to log moderation event for user {UserId}", userId);
            }
        }
    }
}

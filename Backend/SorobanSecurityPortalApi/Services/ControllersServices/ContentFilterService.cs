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
        private readonly ICacheAccessor _cacheAccessor;
        private readonly IModerationLogProcessor _moderationLogProcessor;
        private readonly IExtendedConfig _config;
        private readonly ILogger<ContentFilterService> _logger;

        // Profanity words are read from disk once and cached process-wide (the file never changes at runtime).
        private static readonly Lazy<HashSet<string>> _sharedDefaultProfanityWords = new(LoadDefaultProfanityWordsStatic, LazyThreadSafetyMode.ExecutionAndPublication);

        // Markdig pipeline is immutable and thread-safe once built, so it is shared.
        private static readonly MarkdownPipeline MarkdownPipeline = new MarkdownPipelineBuilder().UseAdvancedExtensions().Build();

        private static readonly string[] AllowedTags = { "p", "br", "strong", "em", "code", "pre", "a", "ul", "ol", "li", "blockquote" };
        private static readonly Regex AnchorHrefRegex = new(@"<a\s+[^>]*href\s*=\s*[""']([^""']*)[""'][^>]*>", RegexOptions.IgnoreCase | RegexOptions.Compiled);
        private static readonly Regex MarkdownLinkRegex = new(@"(?<!!)\[[^\]\r\n]+\]\(([^)\r\n]+)\)", RegexOptions.Compiled);
        private const int MaxLinksAllowed = 5;
        private const int RateLimitPerMinute = 10;
        private const string RateLimitKeyPrefix = "content_filter_rate_limit:";
        private const string DefaultProfanityWordsFile = "Data/default-profanity-words.txt";

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
        }

        private static HashSet<string> LoadDefaultProfanityWordsStatic()
        {
            try
            {
                // Resolve relative to the deployed assembly, not the (possibly different) process CWD.
                var path = Path.Combine(AppContext.BaseDirectory, DefaultProfanityWordsFile);
                if (File.Exists(path))
                {
                    return File.ReadAllLines(path)
                        .Select(w => w.Trim().ToLowerInvariant())
                        .Where(w => !string.IsNullOrWhiteSpace(w))
                        .ToHashSet();
                }
                return new HashSet<string>();
            }
            catch
            {
                return new HashSet<string>();
            }
        }

        // Ganss HtmlSanitizer is not safe for concurrent Sanitize() calls on a single instance, so a
        // fresh (cheap) instance is built per call. Configuration is centralised here.
        private static IHtmlSanitizer CreateSanitizerInstance()
        {
            var sanitizer = new HtmlSanitizer();
            sanitizer.AllowedTags.Clear();
            foreach (var tag in AllowedTags)
            {
                sanitizer.AllowedTags.Add(tag);
            }
            sanitizer.AllowedAttributes.Clear();
            sanitizer.AllowedAttributes.Add("href");
            sanitizer.AllowedAttributes.Add("class");
            sanitizer.AllowedSchemes.Clear();
            sanitizer.AllowedSchemes.Add("http");
            sanitizer.AllowedSchemes.Add("https");
            return sanitizer;
        }

        public HashSet<string> GetDefaultProfanityWords() => _sharedDefaultProfanityWords.Value;

        public HashSet<string> GetAllProfanityWords()
        {
            var allWords = new HashSet<string>(_sharedDefaultProfanityWords.Value, StringComparer.OrdinalIgnoreCase);
            foreach (var word in _config.ProfanityWords)
            {
                allWords.Add(word.ToLowerInvariant());
            }
            return allWords;
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

            var markdownHtml = Markdown.ToHtml(content, MarkdownPipeline);

            // Per-call sanitizer instance — HtmlSanitizer is not concurrency-safe (see CreateSanitizerInstance).
            var sanitizedHtml = CreateSanitizerInstance().Sanitize(markdownHtml);

            result.SanitizedContent = sanitizedHtml;

            await CheckSpamAsync(result, userId, originalContent);

            CheckProfanity(result, originalContent);

            CheckLinkFlooding(result, markdownHtml);

            ValidateUrls(result, ExtractLinkTargets(markdownHtml, originalContent));

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
            if (_config.ProfanityFilterEnabled)
            {
                var allWords = GetAllProfanityWords();
                if (allWords.Count > 0)
                {
                    var lowerContent = content.ToLowerInvariant();
                    var foundProfanity = allWords
                        .Where(word => Regex.IsMatch(lowerContent, $@"\b{Regex.Escape(word)}\b", RegexOptions.IgnoreCase))
                        .ToList();

                    if (foundProfanity.Any())
                    {
                        result.RequiresModeration = true;
                        result.Warnings.Add($"Profanity detected: {foundProfanity.Count} word(s) matched");
                        _logger.LogWarning("Profanity detected in content from user");
                    }
                }
            }
        }

        private void CheckLinkFlooding(ContentFilterResult result, string html)
        {
            var linkMatches = AnchorHrefRegex.Matches(html);
            if (linkMatches.Count > MaxLinksAllowed)
            {
                result.IsBlocked = true;
                result.Warnings.Add($"Too many links detected: {linkMatches.Count} (max: {MaxLinksAllowed})");
                _logger.LogWarning("Link flooding detected: {LinkCount} links", linkMatches.Count);
            }
        }

        private static IEnumerable<string> ExtractLinkTargets(string html, string markdown)
        {
            var seenTargets = new HashSet<string>(StringComparer.Ordinal);

            foreach (Match match in AnchorHrefRegex.Matches(html))
            {
                if (match.Groups.Count <= 1)
                {
                    continue;
                }

                var target = System.Net.WebUtility.HtmlDecode(match.Groups[1].Value).Trim();
                if (!string.IsNullOrWhiteSpace(target) && seenTargets.Add(target))
                {
                    yield return target;
                }
            }

            foreach (Match match in MarkdownLinkRegex.Matches(markdown))
            {
                if (match.Groups.Count <= 1)
                {
                    continue;
                }

                var target = NormalizeMarkdownLinkTarget(match.Groups[1].Value);
                if (!string.IsNullOrWhiteSpace(target) && seenTargets.Add(target))
                {
                    yield return target;
                }
            }
        }

        private static string NormalizeMarkdownLinkTarget(string rawTarget)
        {
            var target = rawTarget.Trim();
            if (target.StartsWith("<", StringComparison.Ordinal))
            {
                var closingAngleIndex = target.IndexOf('>');
                if (closingAngleIndex > 1)
                {
                    return target[1..closingAngleIndex].Trim();
                }
            }

            var whitespaceIndex = target.IndexOfAny(new[] { ' ', '\t', '\r', '\n' });
            if (whitespaceIndex > 0)
            {
                var firstToken = target[..whitespaceIndex];
                if (Uri.TryCreate(firstToken, UriKind.Absolute, out _))
                {
                    return firstToken;
                }
            }

            return target.Trim('"', '\'');
        }

        private void ValidateUrls(ContentFilterResult result, IEnumerable<string> urls)
        {
            var trustedDomains = _config.TrustedDomains;

            foreach (var url in urls)
            {
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

        // Fixed-window rate limiter keyed by the current calendar minute (UTC). The bucket key name
        // itself rolls over at each minute boundary, so the count resets every minute regardless of
        // how many times the TTL is re-written, and a stale bucket key self-expires after its TTL.
        // NOTE: ICacheAccessor wraps IDistributedCache, which exposes neither an atomic INCR nor the
        // remaining TTL, so the read-then-write within a single minute is not atomic — concurrent
        // requests in the same minute can over-count slightly. That residual race is acceptable here.
        public Task<bool> CheckRateLimitAsync(int userId)
        {
            var bucket = DateTime.UtcNow.ToString("yyyyMMddHHmm");
            var cacheKey = $"{RateLimitKeyPrefix}{userId}_{bucket}";

            var currentValue = _cacheAccessor.GetCacheValue(cacheKey);
            var count = int.TryParse(currentValue, out var parsed) ? parsed : 0;

            var newCount = count + 1;
            // TTL of 120s comfortably outlives the 1-minute window so the bucket survives until it is
            // no longer relevant, then self-expires.
            _cacheAccessor.SetCacheValue(cacheKey, newCount.ToString(), 120);

            if (newCount > RateLimitPerMinute)
            {
                _logger.LogWarning("Rate limit exceeded for user {UserId}: {Count} attempts", userId, newCount);
                return Task.FromResult(false);
            }

            return Task.FromResult(true);
        }

        private const int MaxStoredContentLength = 2000;

        private async Task LogModerationAsync(int userId, string originalContent, string sanitizedContent, string reason, ContentFilterResult result)
        {
            try
            {
                var log = new ModerationLogModel
                {
                    UserId = userId,
                    OriginalContent = originalContent.Length > MaxStoredContentLength
                        ? originalContent[..MaxStoredContentLength]
                        : originalContent,
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

using System.Security.Cryptography;
using System.Text;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;

namespace SorobanSecurityPortalApi.Services.ControllersServices
{
    public interface IPageViewService
    {
        // forcedSource lets OgController record a Crawler view regardless of UA.
        Task RecordView(EntityType entityType, int entityId, string? ipAddress, string? userAgent, PageViewSource? forcedSource = null);
        Task<PageViewCountViewModel> GetCounts(EntityType entityType, int entityId);
        Task<AnalyticsStatisticsViewModel> GetStatistics();
    }

    public class PageViewService : IPageViewService
    {
        private readonly IPageViewProcessor _processor;
        private readonly IExtendedConfig _config;

        public PageViewService(IPageViewProcessor processor, IExtendedConfig config)
        {
            _processor = processor;
            _config = config;
        }

        public async Task RecordView(EntityType entityType, int entityId, string? ipAddress, string? userAgent, PageViewSource? forcedSource = null)
        {
            if (entityId <= 0) return;
            var source = forcedSource ?? (BotUserAgent.IsBot(userAgent) ? PageViewSource.Crawler : PageViewSource.Human);
            var hash = ComputeVisitorHash(ipAddress, userAgent);

            // Per-visitor/day dedupe keeps "total" meaningful while still growing day over day.
            // NOTE: this check-then-insert is intentionally not transactionally atomic. Two
            // concurrent requests for the same visitor/entity/day could both pass ExistsTodayAsync
            // and both insert (a classic TOCTOU race). This is an accepted, bounded tradeoff: the
            // worst case is a small over-count of Total under rare concurrent double-submits — there
            // is no data corruption and no PII risk. We deliberately avoid a unique constraint /
            // schema change here; the SPA also guards against double-fire with a useRef on mount.
            if (await _processor.ExistsTodayAsync(entityType, entityId, hash, source))
                return;

            await _processor.AddAsync(new PageViewModel
            {
                EntityType = entityType,
                EntityId = entityId,
                ViewedAt = DateTime.UtcNow,
                VisitorHash = hash,
                Source = source
            });
        }

        public Task<PageViewCountViewModel> GetCounts(EntityType entityType, int entityId)
            => _processor.GetCountsAsync(entityType, entityId);

        public Task<AnalyticsStatisticsViewModel> GetStatistics()
            => _processor.GetStatisticsAsync();

        // HMAC-SHA256("page-view" + ip + ua + yyyy-MM-dd) keyed by a server secret.
        // One-way + keyed → the raw IP cannot be recovered or brute-forced offline. No PII at rest.
        // The leading "page-view" context string provides domain separation: it ensures this
        // analytics pseudonym can never collide with the JWT signing use of the same shared key.
        // NOTE: the key (AuthSecurityKey) is shared with auth; rotating it intentionally resets all
        // visitor pseudonyms (past hashes stop matching), which is acceptable for analytics.
        private string ComputeVisitorHash(string? ip, string? ua)
        {
            var material = $"page-view|{ip}|{ua}|{DateTime.UtcNow:yyyy-MM-dd}";
            // AuthSecurityKey is a required, validated config value; the "??" guard is only a
            // design-time/test safety net and is effectively dead in production.
            var key = Encoding.UTF8.GetBytes(_config.AuthSecurityKey ?? "soroban-analytics-salt");
            using var hmac = new HMACSHA256(key);
            var bytes = hmac.ComputeHash(Encoding.UTF8.GetBytes(material));
            return Convert.ToHexString(bytes).ToLowerInvariant(); // 64 hex chars
        }
    }
}

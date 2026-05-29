using Microsoft.EntityFrameworkCore;
using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;

namespace SorobanSecurityPortalApi.Data.Processors
{
    public class PageViewProcessor : IPageViewProcessor
    {
        private const int TopEntitiesPerType = 5;
        private const int DailySeriesDays = 30;

        private readonly IDbContextFactory<Db> _dbFactory;
        public PageViewProcessor(IDbContextFactory<Db> dbFactory) => _dbFactory = dbFactory;

        // Returns true if this visitor already has a row for this entity/source today (UTC).
        public async Task<bool> ExistsTodayAsync(EntityType entityType, int entityId, string visitorHash, PageViewSource source)
        {
            var dayStart = DateTime.UtcNow.Date;
            var dayEnd = dayStart.AddDays(1);
            await using var db = await _dbFactory.CreateDbContextAsync();
            return await db.PageView.AsNoTracking().AnyAsync(p =>
                p.EntityType == entityType &&
                p.EntityId == entityId &&
                p.Source == source &&
                p.VisitorHash == visitorHash &&
                p.ViewedAt >= dayStart && p.ViewedAt < dayEnd);
        }

        public async Task AddAsync(PageViewModel row)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            db.PageView.Add(row);
            await db.SaveChangesAsync();
        }

        // Human counts for the public per-entity counter.
        public async Task<PageViewCountViewModel> GetCountsAsync(EntityType entityType, int entityId)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var q = db.PageView.AsNoTracking().Where(p =>
                p.EntityType == entityType && p.EntityId == entityId && p.Source == PageViewSource.Human);
            var total = await q.CountAsync();
            // Range comparison against a UTC instant — not date_trunc — so no session-timezone issue.
            var todayStartUtc = DateTime.UtcNow.Date;
            var today = await q.CountAsync(p => p.ViewedAt >= todayStartUtc);
            var unique = await q.Select(p => p.VisitorHash).Distinct().CountAsync();
            return new PageViewCountViewModel { Total = total, Today = today, Unique = unique };
        }

        public async Task<AnalyticsStatisticsViewModel> GetStatisticsAsync()
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var human = db.PageView.AsNoTracking().Where(p => p.Source == PageViewSource.Human);

            var result = new AnalyticsStatisticsViewModel
            {
                TotalHumanViews = await human.CountAsync(),
                UniqueVisitors = await human.Select(p => p.VisitorHash).Distinct().CountAsync(),
                CrawlerShares = await db.PageView.AsNoTracking().CountAsync(p => p.Source == PageViewSource.Crawler),
            };

            // Top human-viewed entities per type, with titles resolved from each entity table.
            foreach (var type in new[] { EntityType.Report, EntityType.Auditor, EntityType.Vulnerability, EntityType.Protocol })
            {
                var top = await human.Where(p => p.EntityType == type)
                    .GroupBy(p => p.EntityId)
                    .Select(g => new { EntityId = g.Key, Views = g.Count() })
                    .OrderByDescending(x => x.Views)
                    .Take(TopEntitiesPerType)
                    .ToListAsync();

                foreach (var t in top)
                {
                    result.TopEntities.Add(new TopEntityViewModel
                    {
                        EntityType = type,
                        EntityId = t.EntityId,
                        Views = t.Views,
                        Title = await ResolveTitleAsync(db, type, t.EntityId)
                    });
                }
            }
            result.TopEntities = result.TopEntities.OrderByDescending(t => t.Views).ToList();

            // Daily human views for the last N days. We bucket IN MEMORY by UTC calendar day
            // instead of via a SQL GroupBy(p => p.ViewedAt.Date): a database-side group translates
            // to date_trunc('day', viewed_at), which uses the Postgres SESSION timezone and would
            // misalign the buckets with the UTC `since` boundary on a non-UTC server. The window is
            // admin-only and bounded to DailySeriesDays, so materialising the timestamps is cheap.
            var sinceUtc = DateTime.UtcNow.Date.AddDays(-(DailySeriesDays - 1));
            var timestamps = await human.Where(p => p.ViewedAt >= sinceUtc)
                .Select(p => p.ViewedAt)
                .ToListAsync();
            result.Daily = timestamps
                .GroupBy(ts => DateTime.SpecifyKind(ts, DateTimeKind.Utc).Date)
                .Select(g => new DailyViewsViewModel { Date = g.Key, Views = g.Count() })
                .OrderBy(d => d.Date)
                .ToList();

            return result;
        }

        private static async Task<string> ResolveTitleAsync(Db db, EntityType type, int id)
        {
            string? title = type switch
            {
                EntityType.Report => await db.Report.AsNoTracking().Where(r => r.Id == id).Select(r => r.Name).FirstOrDefaultAsync(),
                EntityType.Auditor => await db.Auditor.AsNoTracking().Where(a => a.Id == id).Select(a => a.Name).FirstOrDefaultAsync(),
                EntityType.Vulnerability => await db.Vulnerability.AsNoTracking().Where(v => v.Id == id).Select(v => v.Title).FirstOrDefaultAsync(),
                EntityType.Protocol => await db.Protocol.AsNoTracking().Where(p => p.Id == id).Select(p => p.Name).FirstOrDefaultAsync(),
                _ => null
            };
            return string.IsNullOrWhiteSpace(title) ? $"{type} #{id}" : title!;
        }
    }

    public interface IPageViewProcessor
    {
        Task<bool> ExistsTodayAsync(EntityType entityType, int entityId, string visitorHash, PageViewSource source);
        Task AddAsync(PageViewModel row);
        Task<PageViewCountViewModel> GetCountsAsync(EntityType entityType, int entityId);
        Task<AnalyticsStatisticsViewModel> GetStatisticsAsync();
    }
}

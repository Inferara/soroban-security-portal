using Microsoft.EntityFrameworkCore;
using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;

namespace SorobanSecurityPortalApi.Data.Processors
{
    public class ApiUsageLogProcessor : IApiUsageLogProcessor
    {
        private readonly IDbContextFactory<Db> _dbFactory;

        public ApiUsageLogProcessor(IDbContextFactory<Db> dbFactory)
        {
            _dbFactory = dbFactory;
        }

        public async Task Add(ApiUsageLogModel entry)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            db.ApiUsageLog.Add(entry);
            await db.SaveChangesAsync();
        }

        public async Task AddRange(IEnumerable<ApiUsageLogModel> entries)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            db.ApiUsageLog.AddRange(entries);
            await db.SaveChangesAsync();
        }

        // Calls that count against the daily quota of one key (everything except the ones we refused).
        public async Task<int> CountCountedSince(int apiKeyId, DateTime sinceUtc)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            return await db.ApiUsageLog.CountAsync(u =>
                u.ApiKeyId == apiKeyId && u.CreatedAt >= sinceUtc && u.Status != ApiUsageStatus.RateLimited);
        }

        // Same for a user: calls made with any of their personal keys (service keys issued by the
        // same person count against the service key, not against them).
        public async Task<int> CountCountedForLoginSince(int loginId, DateTime sinceUtc)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            return await db.ApiUsageLog.CountAsync(u =>
                u.LoginId == loginId
                && u.CreatedAt >= sinceUtc
                && u.Status != ApiUsageStatus.RateLimited
                && db.ApiKey.Any(k => k.Id == u.ApiKeyId && k.Kind == ApiKeyKind.Personal));
        }

        public async Task<ApiUsageStatisticsViewModel> GetStatistics(DateTime fromUtc, DateTime toUtc)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var rows = db.ApiUsageLog.AsNoTracking().Where(u => u.CreatedAt >= fromUtc && u.CreatedAt < toUtc);

            // A row stands for Count calls (refusals are written in aggregate), so calls are sums.
            var result = new ApiUsageStatisticsViewModel
            {
                From = fromUtc,
                To = toUtc,
                LogRows = await rows.CountAsync(),
                TotalCalls = await rows.SumAsync(u => u.Count),
                FailedCalls = await rows.Where(u => u.Status == ApiUsageStatus.Error).SumAsync(u => u.Count),
                RateLimitedCalls = await rows.Where(u => u.Status == ApiUsageStatus.RateLimited).SumAsync(u => u.Count),
                ActiveKeys = await rows.Select(u => u.ApiKeyId).Distinct().CountAsync(),
                ActiveUsers = await rows.Where(u => u.LoginId != 0).Select(u => u.LoginId).Distinct().CountAsync(),
            };

            var daily = await rows
                .GroupBy(u => new { u.CreatedAt.Date, u.Source })
                .Select(g => new { g.Key.Date, g.Key.Source, Count = g.Sum(u => u.Count) })
                .ToListAsync();
            // Every day in the range gets a row, so the chart has no gaps.
            for (var day = fromUtc.Date; day < toUtc; day = day.AddDays(1))
            {
                result.Daily.Add(new ApiUsageDailyViewModel
                {
                    Date = day,
                    Mcp = daily.Where(d => d.Date == day && d.Source == ApiUsageSource.Mcp).Sum(d => d.Count),
                    Rest = daily.Where(d => d.Date == day && d.Source == ApiUsageSource.Rest).Sum(d => d.Count),
                });
            }

            result.ByOperation = (await rows
                    .GroupBy(u => new { u.Operation, u.Source })
                    .Select(g => new ApiUsageOperationViewModel
                    {
                        Operation = g.Key.Operation,
                        Source = g.Key.Source,
                        Calls = g.Sum(u => u.Count),
                        Errors = g.Where(u => u.Status == ApiUsageStatus.Error).Sum(u => u.Count),
                        // Refusals take no time; leave them out of the average.
                        AverageDurationMs = (int)(g.Where(u => u.Status != ApiUsageStatus.RateLimited).Average(u => (double?)u.DurationMs) ?? 0),
                    })
                    .ToListAsync())
                .OrderByDescending(o => o.Calls)
                .ToList();

            var byKey = await rows
                .GroupBy(u => u.ApiKeyId)
                .Select(g => new { ApiKeyId = g.Key, Calls = g.Sum(u => u.Count), LastCallAt = g.Max(u => u.CreatedAt) })
                .OrderByDescending(g => g.Calls)
                .Take(50)
                .ToListAsync();
            var keyIds = byKey.Select(k => k.ApiKeyId).ToList();
            var keys = await db.ApiKey
                .AsNoTracking()
                .Where(k => keyIds.Contains(k.Id))
                .Select(k => new
                {
                    k.Id,
                    k.Name,
                    k.KeyPrefix,
                    k.Kind,
                    OwnerName = k.Login != null ? k.Login.FullName : "",
                    OwnerLogin = k.Login != null ? k.Login.Login : "",
                })
                .ToDictionaryAsync(k => k.Id);
            foreach (var k in byKey)
            {
                keys.TryGetValue(k.ApiKeyId, out var info);
                result.ByKey.Add(new ApiUsageKeyViewModel
                {
                    ApiKeyId = k.ApiKeyId,
                    Name = info?.Name ?? "(deleted key)",
                    KeyPrefix = info?.KeyPrefix ?? "",
                    Kind = info?.Kind ?? ApiKeyKind.Personal,
                    OwnerName = info?.OwnerName ?? "",
                    OwnerLogin = info?.OwnerLogin ?? "",
                    Calls = k.Calls,
                    LastCallAt = k.LastCallAt,
                });
            }

            return result;
        }

        public async Task<List<ApiUsageExportRow>> Export(DateTime fromUtc, DateTime toUtc, int maxRows)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            return await (
                    from u in db.ApiUsageLog.AsNoTracking()
                    where u.CreatedAt >= fromUtc && u.CreatedAt < toUtc
                    join k in db.ApiKey.AsNoTracking() on u.ApiKeyId equals k.Id into keys
                    from k in keys.DefaultIfEmpty()
                    orderby u.Id descending
                    select new ApiUsageExportRow
                    {
                        CreatedAt = u.CreatedAt,
                        Source = u.Source,
                        Operation = u.Operation,
                        Status = u.Status,
                        DurationMs = u.DurationMs,
                        Count = u.Count,
                        Arguments = u.Arguments,
                        ApiKeyId = u.ApiKeyId,
                        KeyName = k != null ? k.Name : "",
                        KeyKind = k != null ? k.Kind : ApiKeyKind.Personal,
                        LoginId = u.LoginId,
                    })
                .Take(maxRows)
                .ToListAsync();
        }
    }

    public interface IApiUsageLogProcessor
    {
        Task Add(ApiUsageLogModel entry);
        Task AddRange(IEnumerable<ApiUsageLogModel> entries);
        Task<int> CountCountedSince(int apiKeyId, DateTime sinceUtc);
        Task<int> CountCountedForLoginSince(int loginId, DateTime sinceUtc);
        Task<ApiUsageStatisticsViewModel> GetStatistics(DateTime fromUtc, DateTime toUtc);
        Task<List<ApiUsageExportRow>> Export(DateTime fromUtc, DateTime toUtc, int maxRows);
    }
}

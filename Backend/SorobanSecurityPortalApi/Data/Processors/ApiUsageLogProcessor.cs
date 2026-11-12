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

        // Calls that count against the daily quota (everything except the ones we refused).
        public async Task<int> CountCountedSince(int apiKeyId, DateTime sinceUtc)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            return await db.ApiUsageLog.CountAsync(u =>
                u.ApiKeyId == apiKeyId && u.CreatedAt >= sinceUtc && u.Status != ApiUsageStatus.RateLimited);
        }

        public async Task<ApiUsageStatisticsViewModel> GetStatistics(DateTime fromUtc, DateTime toUtc)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var rows = db.ApiUsageLog.AsNoTracking().Where(u => u.CreatedAt >= fromUtc && u.CreatedAt < toUtc);

            var result = new ApiUsageStatisticsViewModel
            {
                From = fromUtc,
                To = toUtc,
                TotalCalls = await rows.CountAsync(),
                FailedCalls = await rows.CountAsync(u => u.Status == ApiUsageStatus.Error),
                RateLimitedCalls = await rows.CountAsync(u => u.Status == ApiUsageStatus.RateLimited),
                ActiveKeys = await rows.Select(u => u.ApiKeyId).Distinct().CountAsync(),
                ActiveUsers = await rows.Select(u => u.LoginId).Distinct().CountAsync(),
            };

            var daily = await rows
                .GroupBy(u => new { u.CreatedAt.Date, u.Source })
                .Select(g => new { g.Key.Date, g.Key.Source, Count = g.Count() })
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
                        Calls = g.Count(),
                        Errors = g.Count(u => u.Status == ApiUsageStatus.Error),
                        AverageDurationMs = (int)g.Average(u => u.DurationMs),
                    })
                    .ToListAsync())
                .OrderByDescending(o => o.Calls)
                .ToList();

            var byKey = await rows
                .GroupBy(u => u.ApiKeyId)
                .Select(g => new { ApiKeyId = g.Key, Calls = g.Count(), LastCallAt = g.Max(u => u.CreatedAt) })
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
        Task<int> CountCountedSince(int apiKeyId, DateTime sinceUtc);
        Task<ApiUsageStatisticsViewModel> GetStatistics(DateTime fromUtc, DateTime toUtc);
        Task<List<ApiUsageExportRow>> Export(DateTime fromUtc, DateTime toUtc, int maxRows);
    }
}

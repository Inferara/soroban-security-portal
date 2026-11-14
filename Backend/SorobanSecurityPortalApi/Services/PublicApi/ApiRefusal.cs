using System.Collections.Concurrent;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.DbModels;

namespace SorobanSecurityPortalApi.Services.PublicApi
{
    // Refused calls (over a limit) are counted in memory and written to the usage log as one row
    // per key, operation and minute, with a count. A client that keeps hammering after it was
    // refused therefore costs no database writes per request, and the statistics still show the
    // exact number of refusals.
    public class ApiRefusalAggregator : IApiRefusalAggregator
    {
        private sealed record Key(int ApiKeyId, int LoginId, ApiUsageSource Source, string Operation, DateTime Minute);

        private sealed class Counter
        {
            public int Count;
        }

        private readonly ConcurrentDictionary<Key, Counter> _counts = new();
        private readonly TimeProvider _time;

        public ApiRefusalAggregator() : this(TimeProvider.System) { }

        public ApiRefusalAggregator(TimeProvider time)
        {
            _time = time;
        }

        public void Record(ApiCaller caller, ApiUsageSource source, string operation)
        {
            var key = new Key(caller.ApiKeyId, caller.LoggedLoginId, source, operation, MinuteOf(_time.GetUtcNow()));
            Interlocked.Increment(ref _counts.GetOrAdd(key, _ => new Counter()).Count);
        }

        // Rows for minutes that are over. A minute only counts as over after a one minute grace
        // period, so a call that read the clock just before the minute turned over cannot add to
        // a row that was already taken. all = true (shutdown) takes everything.
        public List<ApiUsageLogModel> Drain(bool all)
        {
            var cutoff = MinuteOf(_time.GetUtcNow()).AddMinutes(-1);
            var rows = new List<ApiUsageLogModel>();
            foreach (var (key, counter) in _counts)
            {
                if (!all && key.Minute >= cutoff) continue;
                if (!_counts.TryRemove(key, out var removed)) continue;
                var count = Volatile.Read(ref removed.Count);
                if (count <= 0) continue;
                rows.Add(new ApiUsageLogModel
                {
                    ApiKeyId = key.ApiKeyId,
                    LoginId = key.LoginId,
                    Source = key.Source,
                    Operation = key.Operation,
                    Status = ApiUsageStatus.RateLimited,
                    DurationMs = 0,
                    Count = count,
                    CreatedAt = key.Minute,
                });
            }
            return rows;
        }

        // Puts rows back after a failed write, so the next flush retries them.
        public void Restore(IEnumerable<ApiUsageLogModel> rows)
        {
            foreach (var row in rows)
            {
                var key = new Key(row.ApiKeyId, row.LoginId, row.Source, row.Operation, row.CreatedAt);
                Interlocked.Add(ref _counts.GetOrAdd(key, _ => new Counter()).Count, row.Count);
            }
        }

        private static DateTime MinuteOf(DateTimeOffset time) =>
            new(time.UtcDateTime.Ticks - time.UtcDateTime.Ticks % TimeSpan.TicksPerMinute, DateTimeKind.Utc);
    }

    public interface IApiRefusalAggregator
    {
        void Record(ApiCaller caller, ApiUsageSource source, string operation);
        List<ApiUsageLogModel> Drain(bool all);
        void Restore(IEnumerable<ApiUsageLogModel> rows);
    }

    // Writes the aggregated refusals to the usage log every few seconds, and once more on shutdown.
    public class ApiRefusalFlusher : BackgroundService
    {
        private static readonly TimeSpan Interval = TimeSpan.FromSeconds(20);

        private readonly IApiRefusalAggregator _aggregator;
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<ApiRefusalFlusher> _logger;

        public ApiRefusalFlusher(IApiRefusalAggregator aggregator, IServiceScopeFactory scopeFactory, ILogger<ApiRefusalFlusher> logger)
        {
            _aggregator = aggregator;
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            using var timer = new PeriodicTimer(Interval);
            try
            {
                while (await timer.WaitForNextTickAsync(stoppingToken))
                    await Flush(all: false, CancellationToken.None);
            }
            catch (OperationCanceledException)
            {
                // Shutting down: StopAsync does the last flush.
            }
        }

        public override async Task StopAsync(CancellationToken cancellationToken)
        {
            await base.StopAsync(cancellationToken);
            await Flush(all: true, CancellationToken.None);
        }

        private async Task Flush(bool all, CancellationToken cancellationToken)
        {
            var rows = _aggregator.Drain(all);
            if (rows.Count == 0) return;
            try
            {
                using var scope = _scopeFactory.CreateScope();
                await scope.ServiceProvider.GetRequiredService<IApiUsageLogProcessor>().AddRange(rows);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to write {Count} aggregated API refusal rows; will retry", rows.Count);
                _aggregator.Restore(rows);
            }
        }
    }
}

using System.Collections.Concurrent;

namespace SorobanSecurityPortalApi.Services.PublicApi
{
    public enum ApiRateLimitKind
    {
        None = 0,
        PerMinute = 1,
        PerDay = 2,
        Global = 3,
    }

    public sealed record ApiRateLimitDecision(bool Allowed, ApiRateLimitKind Kind, int Limit, int RetryAfterSeconds)
    {
        public static readonly ApiRateLimitDecision Ok = new(true, ApiRateLimitKind.None, 0, 0);
    }

    public sealed record ApiRateLimits(int PerMinute, int PerDay, int GlobalPerMinute);

    // Fixed-window limiter for the public API: per key per minute, per key per UTC day, and one
    // global per-minute cap across all keys.
    //
    // Counters live in memory. The API runs as a single replica, so that is exact. The per-day
    // counter is seeded from the usage log the first time a key is seen (seedDailyCount), so an
    // API restart does not hand everyone a fresh daily quota. If the API is ever scaled out,
    // this is the one class to back with Redis.
    public class ApiRateLimiter : IApiRateLimiter
    {
        private sealed class KeyState
        {
            public long MinuteWindow;
            public int MinuteCount;
            public long DayWindow = -1;
            public int DayCount;
        }

        private readonly ConcurrentDictionary<int, KeyState> _keys = new();
        private readonly object _globalLock = new();
        private readonly TimeProvider _time;
        private long _globalWindow;
        private int _globalCount;

        public ApiRateLimiter() : this(TimeProvider.System) { }

        public ApiRateLimiter(TimeProvider time)
        {
            _time = time;
        }

        public async Task<ApiRateLimitDecision> TryAcquireAsync(int apiKeyId, ApiRateLimits limits, Func<DateTime, Task<int>> seedDailyCount)
        {
            var now = _time.GetUtcNow();
            var minuteWindow = now.ToUnixTimeSeconds() / 60;
            var dayWindow = now.ToUnixTimeSeconds() / 86400;
            var secondsToNextMinute = 60 - (int)(now.ToUnixTimeSeconds() % 60);
            var secondsToNextDay = 86400 - (int)(now.ToUnixTimeSeconds() % 86400);

            var state = _keys.GetOrAdd(apiKeyId, _ => new KeyState());

            // Seed outside the lock (it hits the database). Two concurrent first calls may both
            // seed; they read the same number, so the result is the same.
            int? seededDayCount = null;
            if (Volatile.Read(ref state.DayWindow) < dayWindow)
                seededDayCount = await seedDailyCount(now.UtcDateTime.Date);

            lock (state)
            {
                // "<", not "!=": a call that read the clock just before a window turned over and
                // then waited (on the seed query, or for this lock) must not move the window back.
                if (state.DayWindow < dayWindow)
                {
                    state.DayWindow = dayWindow;
                    state.DayCount = seededDayCount ?? 0;
                }
                if (state.MinuteWindow < minuteWindow)
                {
                    state.MinuteWindow = minuteWindow;
                    state.MinuteCount = 0;
                }

                if (state.DayCount >= limits.PerDay)
                    return new ApiRateLimitDecision(false, ApiRateLimitKind.PerDay, limits.PerDay, secondsToNextDay);
                if (state.MinuteCount >= limits.PerMinute)
                    return new ApiRateLimitDecision(false, ApiRateLimitKind.PerMinute, limits.PerMinute, secondsToNextMinute);

                // The global check sits inside the key lock so a call refused globally does not
                // consume the key's own quota.
                lock (_globalLock)
                {
                    if (_globalWindow < minuteWindow)
                    {
                        _globalWindow = minuteWindow;
                        _globalCount = 0;
                    }
                    if (_globalCount >= limits.GlobalPerMinute)
                        return new ApiRateLimitDecision(false, ApiRateLimitKind.Global, limits.GlobalPerMinute, secondsToNextMinute);
                    _globalCount++;
                }

                state.MinuteCount++;
                state.DayCount++;
                return ApiRateLimitDecision.Ok;
            }
        }
    }

    public interface IApiRateLimiter
    {
        Task<ApiRateLimitDecision> TryAcquireAsync(int apiKeyId, ApiRateLimits limits, Func<DateTime, Task<int>> seedDailyCount);
    }
}

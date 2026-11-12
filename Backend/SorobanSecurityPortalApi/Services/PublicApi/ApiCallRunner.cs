using System.Diagnostics;
using Microsoft.Extensions.Caching.Memory;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.DbModels;

namespace SorobanSecurityPortalApi.Services.PublicApi
{
    public enum ApiCallStatus
    {
        Ok,
        NotFound,
        BadRequest,
        RateLimited,
        Disabled,
        Unauthorized,
        Error,
    }

    public sealed class ApiCallOutcome<T>
    {
        public ApiCallStatus Status { get; init; }
        public T? Value { get; init; }
        public string? Message { get; init; }
        public int RetryAfterSeconds { get; init; }
    }

    // Thrown by an operation when the caller's input is wrong. The message is shown to the caller.
    public class PublicApiValidationException : Exception
    {
        public PublicApiValidationException(string message) : base(message) { }
    }

    // Every public operation, on either transport, goes through here. This is the one place
    // that enforces the master switch and the limits, and writes the usage log, so MCP tools
    // and REST endpoints cannot disagree about any of it.
    public class ApiCallRunner : IApiCallRunner
    {
        private const int MaxArgumentsLength = 300;

        private readonly IApiCallerAccessor _callerAccessor;
        private readonly IApiRateLimiter _rateLimiter;
        private readonly IApiUsageLogProcessor _usageLog;
        private readonly IApiKeyProcessor _apiKeys;
        private readonly IExtendedConfig _config;
        private readonly IMemoryCache _memoryCache;
        private readonly ILogger<ApiCallRunner> _logger;

        public ApiCallRunner(
            IApiCallerAccessor callerAccessor,
            IApiRateLimiter rateLimiter,
            IApiUsageLogProcessor usageLog,
            IApiKeyProcessor apiKeys,
            IExtendedConfig config,
            IMemoryCache memoryCache,
            ILogger<ApiCallRunner> logger)
        {
            _callerAccessor = callerAccessor;
            _rateLimiter = rateLimiter;
            _usageLog = usageLog;
            _apiKeys = apiKeys;
            _config = config;
            _memoryCache = memoryCache;
            _logger = logger;
        }

        public async Task<ApiCallOutcome<T>> Run<T>(ApiUsageSource source, string operation, string? arguments, Func<Task<T?>> action)
            where T : class
        {
            var caller = _callerAccessor.GetCaller();
            if (caller == null)
                return new ApiCallOutcome<T> { Status = ApiCallStatus.Unauthorized, Message = "A valid API key is required." };

            if (!_config.PublicApiEnabled)
                return new ApiCallOutcome<T> { Status = ApiCallStatus.Disabled, Message = "The public API is temporarily disabled." };

            var limits = new ApiRateLimits(
                Math.Max(1, caller.RateLimitPerMinute ?? _config.PublicApiRateLimitPerMinute),
                Math.Max(1, caller.RateLimitPerDay ?? _config.PublicApiRateLimitPerDay),
                Math.Max(1, _config.PublicApiGlobalRateLimitPerMinute));

            var decision = await _rateLimiter.TryAcquireAsync(
                caller.ApiKeyId, limits, dayStartUtc => _usageLog.CountCountedSince(caller.ApiKeyId, dayStartUtc));
            if (!decision.Allowed)
            {
                await Log(caller, source, operation, arguments, ApiUsageStatus.RateLimited, 0);
                return new ApiCallOutcome<T>
                {
                    Status = ApiCallStatus.RateLimited,
                    RetryAfterSeconds = decision.RetryAfterSeconds,
                    Message = decision.Kind switch
                    {
                        ApiRateLimitKind.PerDay => $"Daily limit of {decision.Limit} calls reached for this API key. Try again in {decision.RetryAfterSeconds} seconds (resets at 00:00 UTC).",
                        ApiRateLimitKind.PerMinute => $"Rate limit of {decision.Limit} calls per minute reached for this API key. Try again in {decision.RetryAfterSeconds} seconds.",
                        _ => $"The API is receiving too many requests right now. Try again in {decision.RetryAfterSeconds} seconds.",
                    },
                };
            }

            var stopwatch = Stopwatch.StartNew();
            ApiCallOutcome<T> outcome;
            try
            {
                var value = await action();
                outcome = value == null
                    ? new ApiCallOutcome<T> { Status = ApiCallStatus.NotFound, Message = "Not found." }
                    : new ApiCallOutcome<T> { Status = ApiCallStatus.Ok, Value = value };
            }
            catch (PublicApiValidationException ex)
            {
                outcome = new ApiCallOutcome<T> { Status = ApiCallStatus.BadRequest, Message = ex.Message };
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Public API operation {Operation} failed", operation);
                outcome = new ApiCallOutcome<T> { Status = ApiCallStatus.Error, Message = "Internal error. Please try again later." };
            }
            stopwatch.Stop();

            var logStatus = outcome.Status switch
            {
                ApiCallStatus.Ok => ApiUsageStatus.Ok,
                ApiCallStatus.NotFound => ApiUsageStatus.NotFound,
                ApiCallStatus.BadRequest => ApiUsageStatus.BadRequest,
                _ => ApiUsageStatus.Error,
            };
            await Log(caller, source, operation, arguments, logStatus, (int)stopwatch.ElapsedMilliseconds);
            await TouchLastUsed(caller.ApiKeyId);
            return outcome;
        }

        // The usage log is bookkeeping: a failure to write it must never fail the caller's request.
        private async Task Log(ApiCaller caller, ApiUsageSource source, string operation, string? arguments, ApiUsageStatus status, int durationMs)
        {
            try
            {
                await _usageLog.Add(new ApiUsageLogModel
                {
                    ApiKeyId = caller.ApiKeyId,
                    LoginId = caller.LoginId,
                    Source = source,
                    Operation = operation,
                    Arguments = Truncate(arguments),
                    Status = status,
                    DurationMs = durationMs,
                    CreatedAt = DateTime.UtcNow,
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to write the API usage log for {Operation}", operation);
            }
        }

        // At most one write per key per minute; "last used" does not need to be more precise.
        private async Task TouchLastUsed(int apiKeyId)
        {
            var cacheKey = $"api-key-touched:{apiKeyId}";
            if (_memoryCache.TryGetValue(cacheKey, out _)) return;
            _memoryCache.Set(cacheKey, true, TimeSpan.FromMinutes(1));
            try
            {
                await _apiKeys.TouchLastUsed(apiKeyId, DateTime.UtcNow);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to update last-used time for API key {ApiKeyId}", apiKeyId);
            }
        }

        private static string? Truncate(string? value)
        {
            if (string.IsNullOrEmpty(value)) return null;
            return value.Length <= MaxArgumentsLength ? value : value[..MaxArgumentsLength];
        }
    }

    public interface IApiCallRunner
    {
        Task<ApiCallOutcome<T>> Run<T>(ApiUsageSource source, string operation, string? arguments, Func<Task<T?>> action)
            where T : class;
    }
}

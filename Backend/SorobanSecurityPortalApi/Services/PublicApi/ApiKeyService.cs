using System.Globalization;
using System.Text;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Common.Security;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;
using static SorobanSecurityPortalApi.Common.ExceptionHandlingMiddleware;

namespace SorobanSecurityPortalApi.Services.PublicApi
{
    // API key management for portal users (their own keys) and admins (all keys, service keys,
    // usage statistics). Reached only with a normal portal session, never with an API key.
    public class ApiKeyService : IApiKeyService
    {
        public const int MaxActiveKeysPerUser = 5;
        public const int MaxKeysCreatedPerUserPerDay = 10;
        public const int MaxNameLength = 100;
        public const int MaxStatisticsDays = 366;
        public const int MaxExportRows = 100_000;

        private readonly IApiKeyProcessor _apiKeys;
        private readonly IApiUsageLogProcessor _usageLog;
        private readonly IUserContextAccessor _userContext;
        private readonly IExtendedConfig _config;
        private readonly ApiKeyLookupCache _lookupCache;

        public ApiKeyService(
            IApiKeyProcessor apiKeys,
            IApiUsageLogProcessor usageLog,
            IUserContextAccessor userContext,
            IExtendedConfig config,
            ApiKeyLookupCache lookupCache)
        {
            _apiKeys = apiKeys;
            _usageLog = usageLog;
            _userContext = userContext;
            _config = config;
            _lookupCache = lookupCache;
        }

        public ApiLimitsViewModel GetLimits() => new()
        {
            RateLimitPerMinute = _config.PublicApiRateLimitPerMinute,
            RateLimitPerDay = _config.PublicApiRateLimitPerDay,
            MaxKeysPerUser = MaxActiveKeysPerUser,
        };

        public async Task<List<ApiKeyViewModel>> ListMine()
        {
            var loginId = await GetLoginId();
            return (await _apiKeys.ListByLogin(loginId)).Select(k => ToViewModel(k)).ToList();
        }

        public async Task<Result<CreatedApiKeyViewModel, string>> CreateMine(CreateApiKeyRequest? request)
        {
            var loginId = await GetLoginId();
            var name = NormalizeName(request?.Name, out var nameError);
            if (nameError != null) return new Result<CreatedApiKeyViewModel, string>.Err(nameError);

            var (created, outcome) = await Create(loginId, name!, ApiKeyKind.Personal, null, null, limited: true);
            return outcome switch
            {
                ApiKeyCreateOutcome.ActiveLimitReached => new Result<CreatedApiKeyViewModel, string>.Err(
                    $"You already have {MaxActiveKeysPerUser} active API keys. Revoke one before creating another."),
                ApiKeyCreateOutcome.DailyCreateLimitReached => new Result<CreatedApiKeyViewModel, string>.Err(
                    $"You can create at most {MaxKeysCreatedPerUserPerDay} API keys per day. Try again later."),
                _ => new Result<CreatedApiKeyViewModel, string>.Ok(created!),
            };
        }

        public async Task<bool> RevokeMine(int keyId)
        {
            var loginId = await GetLoginId();
            return Evicted(await _apiKeys.Revoke(keyId, loginId));
        }

        public async Task<List<ApiKeyViewModel>> ListAll()
        {
            return (await _apiKeys.ListAll())
                .Select(k =>
                {
                    var vm = ToViewModel(k.Key);
                    vm.OwnerLoginId = k.Key.LoginId; // null once the owner/issuer account is gone
                    vm.OwnerName = k.OwnerName;
                    vm.OwnerLogin = k.OwnerLogin;
                    return vm;
                })
                .ToList();
        }

        // A service key records the admin who issued it, but does not depend on that account, and it
        // may carry its own limits.
        public async Task<Result<CreatedApiKeyViewModel, string>> CreateService(CreateServiceApiKeyRequest? request)
        {
            var loginId = await GetLoginId();
            var name = NormalizeName(request?.Name, out var nameError);
            if (nameError != null) return new Result<CreatedApiKeyViewModel, string>.Err(nameError);
            if (request?.RateLimitPerMinute is <= 0 or > 100_000)
                return new Result<CreatedApiKeyViewModel, string>.Err("Calls per minute must be between 1 and 100000.");
            if (request?.RateLimitPerDay is <= 0 or > 10_000_000)
                return new Result<CreatedApiKeyViewModel, string>.Err("Calls per day must be between 1 and 10000000.");

            var (created, _) = await Create(loginId, name!, ApiKeyKind.Service, request?.RateLimitPerMinute, request?.RateLimitPerDay, limited: false);
            return new Result<CreatedApiKeyViewModel, string>.Ok(created!);
        }

        public async Task<bool> RevokeAny(int keyId) => Evicted(await _apiKeys.Revoke(keyId, null));

        // A revoked key must stop working at once, not when its cache entry expires.
        private bool Evicted(string? keyHash)
        {
            if (keyHash == null) return false;
            _lookupCache.Evict(keyHash);
            return true;
        }

        public async Task<ApiUsageStatisticsViewModel> GetStatistics(int days)
        {
            days = Math.Clamp(days, 1, MaxStatisticsDays);
            // Whole UTC days, today included.
            var to = DateTime.UtcNow.Date.AddDays(1);
            var from = to.AddDays(-days);
            var statistics = await _usageLog.GetStatistics(from, to);
            statistics.MaxExportRows = MaxExportRows;
            return statistics;
        }

        public async Task<ApiUsageExport> ExportCsv(int days)
        {
            days = Math.Clamp(days, 1, MaxStatisticsDays);
            var to = DateTime.UtcNow.Date.AddDays(1);
            var from = to.AddDays(-days);
            // One row more than the limit tells us whether the period holds more than we return.
            var rows = await _usageLog.Export(from, to, MaxExportRows + 1);
            var truncated = rows.Count > MaxExportRows;
            if (truncated) rows.RemoveAt(rows.Count - 1);

            var sb = new StringBuilder();
            // One line ending for the whole file, whatever OS the API runs on.
            sb.Append("timestamp_utc,source,operation,status,duration_ms,api_key_id,api_key_name,api_key_kind,user_id,count,arguments").Append('\n');
            foreach (var r in rows)
            {
                sb.Append(r.CreatedAt.ToString("yyyy-MM-ddTHH:mm:ssZ", CultureInfo.InvariantCulture)).Append(',')
                    .Append(r.Source.ToString().ToLowerInvariant()).Append(',')
                    .Append(Csv(r.Operation)).Append(',')
                    .Append(StatusName(r.Status)).Append(',')
                    .Append(r.DurationMs.ToString(CultureInfo.InvariantCulture)).Append(',')
                    .Append(r.ApiKeyId.ToString(CultureInfo.InvariantCulture)).Append(',')
                    .Append(Csv(r.KeyName)).Append(',')
                    .Append(r.KeyKind.ToString().ToLowerInvariant()).Append(',')
                    .Append(r.LoginId.ToString(CultureInfo.InvariantCulture)).Append(',')
                    .Append(r.Count.ToString(CultureInfo.InvariantCulture)).Append(',')
                    .Append(Csv(r.Arguments ?? ""))
                    .Append('\n');
            }
            return new ApiUsageExport(sb.ToString(), truncated);
        }

        // limited: apply the per-user caps (active keys, keys created per day); only for personal keys.
        private async Task<(CreatedApiKeyViewModel? Key, ApiKeyCreateOutcome Outcome)> Create(
            int loginId, string name, ApiKeyKind kind, int? perMinute, int? perDay, bool limited)
        {
            var key = ApiKeyGenerator.Generate();
            var newKey = new ApiKeyModel
            {
                LoginId = loginId,
                Name = name,
                KeyPrefix = ApiKeyGenerator.DisplayPrefix(key),
                KeyHash = ApiKeyGenerator.Hash(key),
                Kind = kind,
                RateLimitPerMinute = perMinute,
                RateLimitPerDay = perDay,
                CreatedAt = DateTime.UtcNow,
            };
            ApiKeyModel? model;
            var outcome = ApiKeyCreateOutcome.Created;
            if (limited)
            {
                var result = await _apiKeys.AddWithinLimits(newKey, MaxActiveKeysPerUser, MaxKeysCreatedPerUserPerDay);
                model = result.Key;
                outcome = result.Outcome;
            }
            else
            {
                model = await _apiKeys.Add(newKey);
            }
            if (model == null) return (null, outcome);

            var vm = new CreatedApiKeyViewModel { Key = key };
            CopyTo(model, vm);
            return (vm, outcome);
        }

        private static string? NormalizeName(string? name, out string? error)
        {
            error = null;
            var trimmed = name?.Trim() ?? "";
            if (trimmed.Length == 0)
            {
                error = "Give the key a name so you can recognise it later.";
                return null;
            }
            if (trimmed.Length > MaxNameLength)
            {
                error = $"The key name must be at most {MaxNameLength} characters.";
                return null;
            }
            return trimmed;
        }

        private static ApiKeyViewModel ToViewModel(ApiKeyModel model)
        {
            var vm = new ApiKeyViewModel();
            CopyTo(model, vm);
            return vm;
        }

        private static void CopyTo(ApiKeyModel model, ApiKeyViewModel vm)
        {
            vm.Id = model.Id;
            vm.Name = model.Name;
            vm.KeyPrefix = model.KeyPrefix;
            vm.Kind = model.Kind;
            vm.RateLimitPerMinute = model.RateLimitPerMinute;
            vm.RateLimitPerDay = model.RateLimitPerDay;
            vm.CreatedAt = model.CreatedAt;
            vm.LastUsedAt = model.LastUsedAt;
            vm.RevokedAt = model.RevokedAt;
        }

        private static string StatusName(ApiUsageStatus status) => status switch
        {
            ApiUsageStatus.Ok => "ok",
            ApiUsageStatus.Error => "error",
            ApiUsageStatus.RateLimited => "rate_limited",
            ApiUsageStatus.NotFound => "not_found",
            ApiUsageStatus.BadRequest => "bad_request",
            _ => status.ToString().ToLowerInvariant(),
        };

        // Quote every text field, and neutralise a leading = + - @ so a spreadsheet does not
        // treat a caller-supplied argument as a formula.
        private static string Csv(string value)
        {
            if (value.Length > 0 && "=+-@\t\r".Contains(value[0]))
                value = "'" + value;
            return "\"" + value.Replace("\"", "\"\"").Replace("\r", " ").Replace("\n", " ") + "\"";
        }

        private async Task<int> GetLoginId()
        {
            var loginId = await _userContext.GetLoginIdOrNullAsync();
            if (loginId is not > 0)
                throw new SorobanSecurityPortalAuthException("User is not authenticated.");
            return loginId.Value;
        }
    }

    public interface IApiKeyService
    {
        ApiLimitsViewModel GetLimits();
        Task<List<ApiKeyViewModel>> ListMine();
        Task<Result<CreatedApiKeyViewModel, string>> CreateMine(CreateApiKeyRequest? request);
        Task<bool> RevokeMine(int keyId);
        Task<List<ApiKeyViewModel>> ListAll();
        Task<Result<CreatedApiKeyViewModel, string>> CreateService(CreateServiceApiKeyRequest? request);
        Task<bool> RevokeAny(int keyId);
        Task<ApiUsageStatisticsViewModel> GetStatistics(int days);
        Task<ApiUsageExport> ExportCsv(int days);
    }

    // Truncated: the period holds more rows than MaxExportRows; the CSV has the newest ones.
    public sealed record ApiUsageExport(string Csv, bool Truncated);
}

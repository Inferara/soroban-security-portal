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
        public const int MaxNameLength = 100;
        public const int MaxStatisticsDays = 366;
        public const int MaxExportRows = 100_000;

        private readonly IApiKeyProcessor _apiKeys;
        private readonly IApiUsageLogProcessor _usageLog;
        private readonly IUserContextAccessor _userContext;
        private readonly IExtendedConfig _config;

        public ApiKeyService(
            IApiKeyProcessor apiKeys,
            IApiUsageLogProcessor usageLog,
            IUserContextAccessor userContext,
            IExtendedConfig config)
        {
            _apiKeys = apiKeys;
            _usageLog = usageLog;
            _userContext = userContext;
            _config = config;
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

            if (await _apiKeys.CountActiveByLogin(loginId, ApiKeyKind.Personal) >= MaxActiveKeysPerUser)
                return new Result<CreatedApiKeyViewModel, string>.Err(
                    $"You already have {MaxActiveKeysPerUser} active API keys. Revoke one before creating another.");

            return new Result<CreatedApiKeyViewModel, string>.Ok(await Create(loginId, name!, ApiKeyKind.Personal, null, null));
        }

        public async Task<bool> RevokeMine(int keyId)
        {
            var loginId = await GetLoginId();
            return await _apiKeys.Revoke(keyId, loginId);
        }

        public async Task<List<ApiKeyViewModel>> ListAll()
        {
            return (await _apiKeys.ListAll())
                .Select(k =>
                {
                    var vm = ToViewModel(k.Key);
                    vm.OwnerLoginId = k.Key.LoginId;
                    vm.OwnerName = k.OwnerName;
                    vm.OwnerLogin = k.OwnerLogin;
                    return vm;
                })
                .ToList();
        }

        // A service key is owned by the admin who issues it and may carry its own limits.
        public async Task<Result<CreatedApiKeyViewModel, string>> CreateService(CreateServiceApiKeyRequest? request)
        {
            var loginId = await GetLoginId();
            var name = NormalizeName(request?.Name, out var nameError);
            if (nameError != null) return new Result<CreatedApiKeyViewModel, string>.Err(nameError);
            if (request?.RateLimitPerMinute is <= 0 or > 100_000)
                return new Result<CreatedApiKeyViewModel, string>.Err("Calls per minute must be between 1 and 100000.");
            if (request?.RateLimitPerDay is <= 0 or > 10_000_000)
                return new Result<CreatedApiKeyViewModel, string>.Err("Calls per day must be between 1 and 10000000.");

            return new Result<CreatedApiKeyViewModel, string>.Ok(
                await Create(loginId, name!, ApiKeyKind.Service, request?.RateLimitPerMinute, request?.RateLimitPerDay));
        }

        public async Task<bool> RevokeAny(int keyId) => await _apiKeys.Revoke(keyId, null);

        public async Task<ApiUsageStatisticsViewModel> GetStatistics(int days)
        {
            days = Math.Clamp(days, 1, MaxStatisticsDays);
            // Whole UTC days, today included.
            var to = DateTime.UtcNow.Date.AddDays(1);
            var from = to.AddDays(-days);
            return await _usageLog.GetStatistics(from, to);
        }

        public async Task<string> ExportCsv(int days)
        {
            days = Math.Clamp(days, 1, MaxStatisticsDays);
            var to = DateTime.UtcNow.Date.AddDays(1);
            var from = to.AddDays(-days);
            var rows = await _usageLog.Export(from, to, MaxExportRows);

            var sb = new StringBuilder();
            // One line ending for the whole file, whatever OS the API runs on.
            sb.Append("timestamp_utc,source,operation,status,duration_ms,api_key_id,api_key_name,api_key_kind,user_id,arguments").Append('\n');
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
                    .Append(Csv(r.Arguments ?? ""))
                    .Append('\n');
            }
            return sb.ToString();
        }

        private async Task<CreatedApiKeyViewModel> Create(int loginId, string name, ApiKeyKind kind, int? perMinute, int? perDay)
        {
            var key = ApiKeyGenerator.Generate();
            var model = await _apiKeys.Add(new ApiKeyModel
            {
                LoginId = loginId,
                Name = name,
                KeyPrefix = ApiKeyGenerator.DisplayPrefix(key),
                KeyHash = ApiKeyGenerator.Hash(key),
                Kind = kind,
                RateLimitPerMinute = perMinute,
                RateLimitPerDay = perDay,
                CreatedAt = DateTime.UtcNow,
            });
            var vm = new CreatedApiKeyViewModel { Key = key };
            CopyTo(model, vm);
            return vm;
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
        Task<string> ExportCsv(int days);
    }
}

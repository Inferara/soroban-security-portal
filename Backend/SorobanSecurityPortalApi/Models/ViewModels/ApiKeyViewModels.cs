using SorobanSecurityPortalApi.Models.DbModels;

namespace SorobanSecurityPortalApi.Models.ViewModels
{
    public class ApiKeyViewModel
    {
        public int Id { get; set; }
        public string Name { get; set; } = "";
        public string KeyPrefix { get; set; } = "";
        public ApiKeyKind Kind { get; set; }
        public int? RateLimitPerMinute { get; set; }
        public int? RateLimitPerDay { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? LastUsedAt { get; set; }
        public DateTime? RevokedAt { get; set; }
        // Only filled in the admin listing.
        public int? OwnerLoginId { get; set; }
        public string? OwnerName { get; set; }
        public string? OwnerLogin { get; set; }
    }

    // Returned exactly once, when the key is created. The full key cannot be read again.
    public class CreatedApiKeyViewModel : ApiKeyViewModel
    {
        public string Key { get; set; } = "";
    }

    public class CreateApiKeyRequest
    {
        public string? Name { get; set; }
    }

    public class CreateServiceApiKeyRequest
    {
        public string? Name { get; set; }
        public int? RateLimitPerMinute { get; set; }
        public int? RateLimitPerDay { get; set; }
    }

    // What the public surface is currently configured to allow. Shown next to the keys so a
    // user knows their limits before hitting them.
    public class ApiLimitsViewModel
    {
        public int RateLimitPerMinute { get; set; }
        public int RateLimitPerDay { get; set; }
        public int MaxKeysPerUser { get; set; }
    }

    public class ApiUsageStatisticsViewModel
    {
        public DateTime From { get; set; }
        public DateTime To { get; set; }
        public int TotalCalls { get; set; }
        public int FailedCalls { get; set; }
        public int RateLimitedCalls { get; set; }
        public int ActiveKeys { get; set; }
        public int ActiveUsers { get; set; }
        public List<ApiUsageDailyViewModel> Daily { get; set; } = new();
        public List<ApiUsageOperationViewModel> ByOperation { get; set; } = new();
        public List<ApiUsageKeyViewModel> ByKey { get; set; } = new();
    }

    public class ApiUsageDailyViewModel
    {
        public DateTime Date { get; set; }
        public int Mcp { get; set; }
        public int Rest { get; set; }
    }

    public class ApiUsageOperationViewModel
    {
        public string Operation { get; set; } = "";
        public ApiUsageSource Source { get; set; }
        public int Calls { get; set; }
        public int Errors { get; set; }
        public int AverageDurationMs { get; set; }
    }

    public class ApiUsageKeyViewModel
    {
        public int ApiKeyId { get; set; }
        public string Name { get; set; } = "";
        public string KeyPrefix { get; set; } = "";
        public ApiKeyKind Kind { get; set; }
        public string OwnerName { get; set; } = "";
        public string OwnerLogin { get; set; } = "";
        public int Calls { get; set; }
        public DateTime LastCallAt { get; set; }
    }

    public class ApiUsageExportRow
    {
        public DateTime CreatedAt { get; set; }
        public ApiUsageSource Source { get; set; }
        public string Operation { get; set; } = "";
        public ApiUsageStatus Status { get; set; }
        public int DurationMs { get; set; }
        public string? Arguments { get; set; }
        public int ApiKeyId { get; set; }
        public string KeyName { get; set; } = "";
        public ApiKeyKind KeyKind { get; set; }
        public int LoginId { get; set; }
    }
}

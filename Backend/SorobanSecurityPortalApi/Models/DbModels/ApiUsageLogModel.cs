using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SorobanSecurityPortalApi.Models.DbModels
{
    // One row per call to the public surface. Used for the admin usage statistics and SCF reporting.
    [Table("api_usage_log")]
    public class ApiUsageLogModel
    {
        [Key]
        public long Id { get; set; }

        // Kept (not cascaded) when a key or user is deleted, so historical totals stay correct.
        public int ApiKeyId { get; set; }

        public int LoginId { get; set; }

        public ApiUsageSource Source { get; set; }

        [Required]
        [MaxLength(64)]
        public string Operation { get; set; } = string.Empty;

        // Short, human-readable summary of the arguments (never the full request).
        [MaxLength(300)]
        public string? Arguments { get; set; }

        public ApiUsageStatus Status { get; set; }

        public int DurationMs { get; set; }

        // How many calls this row stands for. 1 for an ordinary call; refused calls are written in
        // aggregate (one row per key, operation and minute), so they carry the number of refusals.
        public int Count { get; set; } = 1;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    public enum ApiUsageSource
    {
        Mcp = 0,
        Rest = 1,
    }

    public enum ApiUsageStatus
    {
        Ok = 0,
        Error = 1,
        RateLimited = 2,
        NotFound = 3,
        BadRequest = 4,
    }
}

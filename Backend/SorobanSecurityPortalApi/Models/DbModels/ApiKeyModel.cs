using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SorobanSecurityPortalApi.Models.DbModels
{
    // An API key for the public surface (MCP at /api/mcp and REST at /api/public/v1).
    // The key itself is never stored: only its SHA-256 hash and a short prefix for display.
    [Table("api_key")]
    public class ApiKeyModel
    {
        [Key]
        public int Id { get; set; }

        public int LoginId { get; set; }

        public LoginModel? Login { get; set; }

        [Required]
        [MaxLength(100)]
        public string Name { get; set; } = string.Empty;

        // First characters of the key (e.g. "ssp_Ab12Cd34"), enough for the owner to tell keys apart.
        [Required]
        [MaxLength(16)]
        public string KeyPrefix { get; set; } = string.Empty;

        // Lower-case hex SHA-256 of the full key.
        [Required]
        [MaxLength(64)]
        public string KeyHash { get; set; } = string.Empty;

        public ApiKeyKind Kind { get; set; } = ApiKeyKind.Personal;

        // Optional overrides of the default limits. Only meaningful for service keys.
        public int? RateLimitPerMinute { get; set; }

        public int? RateLimitPerDay { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime? LastUsedAt { get; set; }

        public DateTime? RevokedAt { get; set; }
    }

    public enum ApiKeyKind
    {
        // Created by a user on their profile page; default limits.
        Personal = 0,
        // Issued by an admin for a partner integration; may carry its own limits and is
        // reported as its own source in the usage statistics.
        Service = 1,
    }
}

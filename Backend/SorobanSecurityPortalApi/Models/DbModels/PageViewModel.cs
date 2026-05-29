using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SorobanSecurityPortalApi.Models.DbModels
{
    // How a view arrived. Human = recorded by the SPA on mount; Crawler = recorded by
    // OgController when a social link-preview bot fetches OpenGraph metadata.
    public enum PageViewSource
    {
        Human = 1,
        Crawler = 2
    }

    [Table("page_view")]
    public class PageViewModel
    {
        [Key]
        public int Id { get; set; }

        // Reuses the shared EntityType enum (Protocol/Auditor/Vulnerability/Report).
        [Required]
        public EntityType EntityType { get; set; }

        [Required]
        public int EntityId { get; set; }

        [Required]
        public DateTime ViewedAt { get; set; } = DateTime.UtcNow;

        // Salted HMAC-SHA256 of (ip + user-agent + UTC date). Pseudonymous; NO raw IP/PII stored.
        [Required]
        [MaxLength(64)]
        public string VisitorHash { get; set; } = string.Empty;

        [Required]
        public PageViewSource Source { get; set; }
    }
}

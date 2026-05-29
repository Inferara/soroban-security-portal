using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SorobanSecurityPortalApi.Models.DbModels
{
    public enum EntityType
    {
        Protocol = 0,
        Auditor = 1,
        Vulnerability = 2,
        Report = 3
    }

    [Table("rating")]
    public class RatingModel
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int UserId { get; set; }

        [Required]
        public EntityType EntityType { get; set; }

        [Required]
        public int EntityId { get; set; }

        [Range(1, 5)]
        public int Score { get; set; }

        [MaxLength(2000)]
        public string Review { get; set; } = string.Empty;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }

        // Moderation suppression flags (mirror vulnerability/report). Hidden or
        // soft-deleted ratings are excluded from all public reads.
        public bool IsHidden { get; set; }
        public bool IsDeleted { get; set; }
    }
}
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SorobanSecurityPortalApi.Models.DbModels
{
    [Table("auditor_rating")]
    public class AuditorRatingModel
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int AuditorId { get; set; }

        [ForeignKey("AuditorId")]
        public AuditorModel Auditor { get; set; } = null!;

        [Required]
        [Range(1, 5)]
        public int QualityScore { get; set; }

        [Required]
        [Range(1, 5)]
        public int CommunicationScore { get; set; }

        [Required]
        [Range(1, 5)]
        public int ThoroughnessScore { get; set; }

        [MaxLength(1000)]
        public string? Comment { get; set; }

        [Required]
        public int CreatedBy { get; set; }

        [ForeignKey("CreatedBy")]
        public LoginModel Creator { get; set; } = null!;

        [Required]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}

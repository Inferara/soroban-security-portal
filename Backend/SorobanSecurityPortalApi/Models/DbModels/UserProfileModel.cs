using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SorobanSecurityPortalApi.Models.DbModels
{
    public class UserProfileModel
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int LoginId { get; set; }

        [ForeignKey("LoginId")]
        public LoginModel Login { get; set; } = null!;

        [MaxLength(500)]
        public string? Bio { get; set; }

        [MaxLength(100)]
        public string? Location { get; set; }

        [MaxLength(200)]
        public string? Website { get; set; }

        [Column(TypeName = "jsonb")]
        public List<string> ExpertiseTags { get; set; } = new List<string>();

        public int ReputationScore { get; set; } = 0;

        [Required]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Required]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
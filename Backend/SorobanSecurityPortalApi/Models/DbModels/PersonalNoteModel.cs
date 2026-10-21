using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SorobanSecurityPortalApi.Models.DbModels
{
    [Table("personal_note")]
    public class PersonalNoteModel
    {
        [Key]
        public int Id { get; set; }

        public int LoginId { get; set; }

        public LoginModel? Login { get; set; }

        public int VulnerabilityId { get; set; }

        public VulnerabilityModel? Vulnerability { get; set; }

        [Required]
        [MaxLength(10000)]
        public string Content { get; set; } = string.Empty;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}

using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SorobanSecurityPortalApi.Models.DbModels
{
    [Table("subscription")]
    public class SubscriptionModel
    {
        [Key] 
        public int Id { get; set; }

        public string? Email { get; set; }
        public DateTime Date { get; set; } = DateTime.UtcNow;

        public int? UserId { get; set; }
        [ForeignKey("UserId")]
        public LoginModel? User { get; set; }

        public int? ProtocolId { get; set; }
        [ForeignKey("ProtocolId")]
        public ProtocolModel? Protocol { get; set; }

        public int? CategoryId { get; set; }
        [ForeignKey("CategoryId")]
        public CategoryModel? Category { get; set; }
    }
}
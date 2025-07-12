using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SorobanSecurityPortalApi.Models.DbModels
{
    [Table("subscription")]
    public class SubscriptionModel
    {
        [Key] 
        public int Id { get; set; }
        public string Email { get; set; } = "";
        public DateTime Date { get; set; }
    }
}
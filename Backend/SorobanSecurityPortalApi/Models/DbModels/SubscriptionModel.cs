using System.ComponentModel.DataAnnotations;

namespace SorobanSecurityPortalApi.Models.DbModels
{
    public class SubscriptionModel
    {
        [Key] 
        public int Id { get; set; }
        public string Email { get; set; } = "";
        public DateTime Date { get; set; }
    }
}
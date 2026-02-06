using SorobanSecurityPortalApi.Common;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SorobanSecurityPortalApi.Models.DbModels
{
    [Table("badge_definitions")]
    public class BadgeDefinitionModel
    {
        [Key] public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Icon { get; set; } = string.Empty; 
        public BadgeCategory Category { get; set; }
        public string Criteria { get; set; } = string.Empty; 
    }
}

using SorobanSecurityPortalApi.Common;
using System.ComponentModel.DataAnnotations;

namespace SorobanSecurityPortalApi.Models.DbModels
{
    public class BadgeDefinitionModel
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Icon { get; set; } = string.Empty; 
        public BadgeCategory Category { get; set; }
        public string Criteria { get; set; } = string.Empty; 
    }
}
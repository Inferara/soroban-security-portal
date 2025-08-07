using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SorobanSecurityPortalApi.Models.DbModels
{
    [Table("project")]
    public class ProtocolModel
    {
        [Key] 
        public int Id { get; set; }
        public string Name { get; set; } = "";
        public int? CompanyId { get; set; }
        public string Url { get; set; } = "";
        public DateTime Date { get; set; }
        public string CreatedBy { get; set; } = "";
    }
}
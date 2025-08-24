using Pgvector;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SorobanSecurityPortalApi.Models.DbModels
{
    [Table("protocol")]
    public class ProtocolModel
    {
        [Key] 
        public int Id { get; set; }
        public string Name { get; set; } = "";
        [ForeignKey("Company")]
        public int? CompanyId { get; set; }
        public CompanyModel? Company { get; set; } = null!;
        public string Url { get; set; } = "";
        public string Description { get; set; } = "";
        public byte[]? Image { get; set; } = null;
        public DateTime Date { get; set; }
        public string CreatedBy { get; set; } = "";
        [Column(TypeName = "vector(3072)")]
        public Vector? Embedding { get; set; }
        public List<ReportModel> Reports { get; set; } = new();
    }
}
using Pgvector;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SorobanSecurityPortalApi.Models.DbModels
{
    [Table("company")]
    public class CompanyModel
    {
        [Key] 
        public int Id { get; set; }
        public string Name { get; set; } = "";
        public string Url { get; set; } = "";
        public string Description { get; set; } = "";
        public byte[]? Image { get; set; } = null;
        public DateTime Date { get; set; }
        public int CreatedBy { get; set; }
        [Column(TypeName = "vector(3072)")]
        public Vector? Embedding { get; set; }
        public List<ProtocolModel> Protocols { get; set; } = new();
    }
}
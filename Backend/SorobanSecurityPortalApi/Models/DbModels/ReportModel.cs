using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Pgvector;

namespace SorobanSecurityPortalApi.Models.DbModels
{
    [Table("report")]
    public class ReportModel
    {
        [Key] 
        public int Id { get; set; }
        public string Name { get; set; } = "";
        public byte[]? Image { get; set; } = null;
        public byte[]? BinFile { get; set; } = null;
        public string MdFile { get; set; } = "";
        public DateTime Date { get; set; }
        public string Status { get; set; } = "";
        public string Author { get; set; } = "";
        public string LastActionBy { get; set; } = "";
        public DateTime LastActionAt { get; set; }
        [ForeignKey("Protocol")]
        public int? ProtocolId { get; set; }
        public ProtocolModel? Protocol { get; set; } = null!;
        [ForeignKey("Auditor")]
        public int? AuditorId { get; set; }
        public AuditorModel? Auditor { get; set; } = null!;
        [Column(TypeName = "vector(3072)")]
        public Vector? Embedding { get; set; }
        public List<VulnerabilityModel> Vulnerabilities { get; set; } = new();

        //TODO delete
        [Column("protocol")]
        public string? ProtocolLegacy { get; set; } = null;
        public string? Company { get; set; } = "";
        [Column("auditor")]
        public string? AuditorLegacy { get; set; } = null;
    }

    public class ReportModelStatus
    {
        public const string New = "new";
        public const string Approved = "approved";
        public const string Rejected = "rejected";
    }
}
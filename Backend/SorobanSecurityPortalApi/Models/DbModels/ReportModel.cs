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
        public int CreatedBy { get; set; }
        // When the report row was added to the portal. Immutable after insert: Date is the audit's own
        // date (usually months older) and LastActionAt moves on every edit/approval/cover refresh, so
        // neither can drive the home page's "+N this month" counter (issue #201). The column also has
        // a DB default of now() as a safety net for any insert path that forgets to set it.
        public DateTime CreatedAt { get; set; }
        public int LastActionBy { get; set; }
        public DateTime LastActionAt { get; set; }
        [ForeignKey("Protocol")]
        public int? ProtocolId { get; set; }
        public ProtocolModel? Protocol { get; set; } = null!;
        [ForeignKey("Auditor")]
        public int? AuditorId { get; set; }
        public AuditorModel? Auditor { get; set; } = null!;
        public bool IsHidden { get; set; }
        public bool IsDeleted { get; set; }
        // Set when the report was created by the agent-ingestion approve flow. The PDF→markdown
        // background fix job must skip these (their MdFile is the agent's article, not a placeholder
        // to be regenerated) — an explicit flag instead of the fragile "MdFile is non-empty" coupling.
        public bool IsAgentGenerated { get; set; }
        [Column(TypeName = "vector(3072)")]
        public Vector? Embedding { get; set; }
        public List<VulnerabilityModel> Vulnerabilities { get; set; } = new();
    }

    public class ReportModelStatus
    {
        public const string New = "new";
        public const string Approved = "approved";
        public const string Rejected = "rejected";
    }
}
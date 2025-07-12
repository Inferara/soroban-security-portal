using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

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
        public string? Project { get; set; } = null;
        public string? Auditor { get; set; } = null;
    }

    public class ReportModelStatus
    {
        public const string New = "new";
        public const string Approved = "approved";
        public const string Rejected = "rejected";
    }
}
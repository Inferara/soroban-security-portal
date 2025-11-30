using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SorobanSecurityPortalApi.Models.DbModels
{
    [Table("bookmark")]
    public class BookmarkModel
    {
        [Key] public int Id { get; set; }
        public int LoginId { get; set; }
        public int ItemId { get; set; }
        public BookmarkTypeEnum BookmarkType { get; set; }

        [NotMapped] public virtual ReportModel? Report { get; set; }
        [NotMapped] public virtual VulnerabilityModel? Vulnerability { get; set; }
    }

    public enum BookmarkTypeEnum
    {
        Report = 1,
        Vulnerability = 2
    }
}

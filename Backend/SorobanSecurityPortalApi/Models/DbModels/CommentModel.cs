using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SorobanSecurityPortalApi.Models.DbModels
{
    [Table("comment")]
    public class CommentModel
    {
        [Key] 
        public int Id { get; set; }
        public string Content { get; set; } = "";
        public int LoginId { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public CommentEntityType EntityType { get; set; }
        public int EntityId { get; set; }
        public bool IsDeleted { get; set; } = false;
    }

    public enum CommentEntityType
    {
        Report = 1,
        Vulnerability = 2,
        Protocol = 3,
        Auditor = 4,
        Company = 5
    }
}

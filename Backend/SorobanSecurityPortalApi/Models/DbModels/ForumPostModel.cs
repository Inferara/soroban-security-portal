using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SorobanSecurityPortalApi.Models.DbModels
{
    [Table("forum_post")]
    public class ForumPostModel
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int ThreadId { get; set; }

        [Required]
        public int AuthorId { get; set; }

        [Required]
        public string Content { get; set; } = string.Empty;

        public bool IsFirstPost { get; set; }
        public int Votes { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }

        // Relationships
        [ForeignKey("ThreadId")]
        public virtual ForumThreadModel Thread { get; set; }

        [ForeignKey("AuthorId")]
        public virtual LoginModel Author { get; set; }
    }
}
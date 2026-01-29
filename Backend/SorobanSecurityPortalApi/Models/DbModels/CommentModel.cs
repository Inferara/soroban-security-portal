using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SorobanSecurityPortalApi.Models.DbModels
{
    [Table("comments")]
    public class CommentModel
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int AuthorId { get; set; }
        
        [ForeignKey("AuthorId")]
        public virtual LoginModel? Author { get; set; }

        [Required]
        [MaxLength(50)]
        public string? EntityType { get; set; } 

        [Required]
        public int EntityId { get; set; }

        public int? ParentCommentId { get; set; }

        [ForeignKey("ParentCommentId")]
        public virtual CommentModel? ParentComment { get; set; }

        public virtual ICollection<CommentModel> Replies { get; set; } = new List<CommentModel>();

        [Required]
        public string? Content { get; set; }

        public string? ContentHtml { get; set; }

        [Required]
        [MaxLength(20)]
        public CommentStatus Status { get; set; } = CommentStatus.Active;

        public int UpvoteCount { get; set; } = 0;
        public int DownvoteCount { get; set; } = 0;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
        public DateTime? DeletedAt { get; set; }

        public virtual ICollection<MentionModel> Mentions { get; set; } = new List<MentionModel>();
    }
}
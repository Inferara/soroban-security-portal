using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SorobanSecurityPortalApi.Models.DbModels
{
    [Table("login_history")]
    public class LoginHistoryModel
    {
        [Key]
        public int LoginHistoryId { get; set; }
        public int LoginId { get; set; }
        public string Login { get; set; } = string.Empty;
        public string? Code { get; set; }
        public string? CodeChallenge { get; set; }
        public string? RefreshToken { get; set; }
        public bool IsOffline { get; set; }
        public DateTime ValidUntilTime { get; set; } = DateTime.UtcNow;
        public DateTime Created { get; set; } = DateTime.UtcNow;
        public string Picture { get; set; } = string.Empty;
    }
}
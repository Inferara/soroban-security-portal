using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace SorobanSecurityPortalApi.Models.DbModels
{
    public class WatchModel
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public int EntityId { get; set; }
        public string EntityType { get; set; } // "Protocol" or "Auditor"
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
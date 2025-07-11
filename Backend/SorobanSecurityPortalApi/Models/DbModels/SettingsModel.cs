using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Newtonsoft.Json;

namespace SorobanSecurityPortalApi.Models.DbModels
{
    [Table("settings")]
    public class SettingsModel
    {
        [JsonIgnore]
        [Key]
        public int SettingsId { get; set; }
        public int? EntityId { get; set; } = null;
        public SettingType SettingsType { get; set; } = SettingType.Common;
        [Column(TypeName = "jsonb")]
        public Dictionary<string, string> Content { get; set; } = new();
    }

    public enum SettingType
    {
        Common = 1,
        Version = 2,
        EntraCredentials = 3,
        OpenTelemetry = 4,
        LogLevel = 5,
        Logging = 6,
    }
}

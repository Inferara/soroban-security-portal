using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SorobanSecurityPortalApi.Models.DbModels
{
    [Table("file")]
    public class FileModel
    {
        [Key] 
        public int Id { get; set; }
        public string ContainerGuid { get; set; } = "";
        public string Name { get; set; } = "";
        public string Type { get; set; } = "";
        public byte[]? BinFile { get; set; } = null;
        public DateTime Date { get; set; }
        public string Author { get; set; } = "";
    }
}
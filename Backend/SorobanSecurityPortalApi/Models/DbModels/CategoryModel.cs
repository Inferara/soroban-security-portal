using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SorobanSecurityPortalApi.Models.DbModels
{
    [Table("category")]
    public class CategoryModel
    {
        [Key] 
        public int Id { get; set; }
        public string Name { get; set; } = "";
        public string BgColor { get; set; } = "";
        public string TextColor { get; set; } = "";
        public DateTime Date { get; set; }
        public int CreatedBy { get; set; }
    }
}
using SorobanSecurityPortalApi.Models.DbModels;

namespace SorobanSecurityPortalApi.Models.ViewModels
{
    public class BookmarkViewModel
    {
        public int Id { get; set; }
        public int ItemId { get; set; }
        public BookmarkTypeEnum BookmarkType { get; set; }
        public string Title { get; set; } = "";
        public string Description { get; set; } = "";
    }
}

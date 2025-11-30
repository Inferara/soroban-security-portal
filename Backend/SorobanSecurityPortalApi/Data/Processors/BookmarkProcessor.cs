using Microsoft.EntityFrameworkCore;
using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;

namespace SorobanSecurityPortalApi.Data.Processors
{
    public class BookmarkProcessor : IBookmarkProcessor
    {
        private readonly IDbContextFactory<Db> _dbFactory;

        public BookmarkProcessor(IDbContextFactory<Db> dbFactory)
        {
            _dbFactory = dbFactory;
        }

        public async Task<BookmarkModel> Get(int bookmarkModelId)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var bookmark = await db.Bookmark.FindAsync(bookmarkModelId);
            if (bookmark == null)
            {
                throw new KeyNotFoundException($"Bookmark with ID {bookmarkModelId} not found");
            }
            return bookmark;
        }

        public async Task<BookmarkViewModel> Add(BookmarkModel bookmarkModel)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            if (bookmarkModel == null)
            {
                throw new ArgumentNullException(nameof(bookmarkModel), "Bookmark model cannot be null");
            }
            var title = "";
            var description = "";
            if (bookmarkModel.BookmarkType == BookmarkTypeEnum.Report)
            {
                var report = await db.Report.FindAsync(bookmarkModel.ItemId);
                if (report == null)
                {
                    throw new KeyNotFoundException($"Report with ID {bookmarkModel.ItemId} not found");
                }
                title = report.Name;
            } 
            else if (bookmarkModel.BookmarkType == BookmarkTypeEnum.Vulnerability)
            {
                var vulnerability = await db.Vulnerability.FindAsync(bookmarkModel.ItemId);
                if (vulnerability == null)
                {
                    throw new KeyNotFoundException($"Vulnerability with ID {bookmarkModel.ItemId} not found");
                }
                title = vulnerability.Title;
                description = vulnerability.Description;
            }
            else
            {
                throw new ArgumentException($"Invalid BookmarkType: {bookmarkModel.BookmarkType}");
            }
            db.Bookmark.Add(bookmarkModel);
            await db.SaveChangesAsync();
            return new BookmarkViewModel
            {
                Id = bookmarkModel.Id,
                ItemId = bookmarkModel.ItemId,
                BookmarkType = bookmarkModel.BookmarkType,
                Title = title,
                Description = description
            };
        }

        public async Task Delete(int bookmarkModelId)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var bookmark = await db.Bookmark.FindAsync(bookmarkModelId);
            if (bookmark == null)
            {
                throw new KeyNotFoundException($"Bookmark with ID {bookmarkModelId} not found");
            }
            db.Bookmark.Remove(bookmark);
            await db.SaveChangesAsync();
        }

        public async Task<List<BookmarkViewModel>> List()
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var bookmarks = await db.Bookmark.OrderByDescending(x => x.Id).ToListAsync();
            var res = new List<BookmarkViewModel>();
            foreach (var bookmark in bookmarks)
            {
                if (bookmark.BookmarkType == BookmarkTypeEnum.Report)
                {
                    var report = await db.Report.FindAsync(bookmark.ItemId);
                    if (report == null)
                    {
                        throw new Exception($"Report with ID {bookmark.ItemId} not found for bookmark ID {bookmark.Id}");
                    }
                    res.Add(new BookmarkViewModel
                    {
                        Id = bookmark.Id,
                        ItemId = report.Id,
                        BookmarkType = bookmark.BookmarkType,
                        Title = report.Name,
                        Description = ""
                    });
                } else
                {
                    var vulnerability = await db.Vulnerability.FindAsync(bookmark.ItemId);
                    if (vulnerability == null)
                    {
                        throw new Exception($"Vulnerability with ID {bookmark.ItemId} not found for bookmark ID {bookmark.Id}");
                    }
                    res.Add(new BookmarkViewModel
                    {
                        Id = bookmark.Id,
                        ItemId = vulnerability.Id,
                        BookmarkType = bookmark.BookmarkType,
                        Title = vulnerability.Title,
                        Description = vulnerability.Description
                    });
                }
            }
            return res;
        }

    }

    public interface IBookmarkProcessor
    {
        Task<BookmarkModel> Get(int bookmarkModelId);
        Task<BookmarkViewModel> Add(BookmarkModel bookmarkModel);
        Task Delete(int bookmarkModelId);
        Task<List<BookmarkViewModel>> List();
    }
}
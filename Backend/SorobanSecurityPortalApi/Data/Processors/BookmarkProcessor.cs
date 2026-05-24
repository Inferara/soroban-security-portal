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

        public async Task<BookmarkModel> Get(int bookmarkModelId, int loginId)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var bookmark = await db.Bookmark
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == bookmarkModelId && x.LoginId == loginId);
            if (bookmark == null)
            {
                throw new KeyNotFoundException($"Bookmark with ID {bookmarkModelId} not found");
            }
            return bookmark;
        }

        public async Task<BookmarkViewModel> GetViewModel(int bookmarkModelId, int loginId)
        {
            var bookmarks = await List(loginId, bookmarkModelId);
            var bookmark = bookmarks.FirstOrDefault();
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
                var report = await db.Report
                    .AsNoTracking()
                    .Where(x => x.Id == bookmarkModel.ItemId)
                    .Select(x => new { x.Id, x.Name })
                    .FirstOrDefaultAsync();
                if (report == null)
                {
                    throw new KeyNotFoundException($"Report with ID {bookmarkModel.ItemId} not found");
                }
                title = report.Name;
            } 
            else if (bookmarkModel.BookmarkType == BookmarkTypeEnum.Vulnerability)
            {
                var vulnerability = await db.Vulnerability
                    .AsNoTracking()
                    .Where(x => x.Id == bookmarkModel.ItemId)
                    .Select(x => new { x.Id, x.Title, x.Description })
                    .FirstOrDefaultAsync();
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

        public async Task Delete(int bookmarkModelId, int loginId)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var bookmark = await db.Bookmark
                .FirstOrDefaultAsync(x => x.Id == bookmarkModelId && x.LoginId == loginId);
            if (bookmark == null)
            {
                throw new KeyNotFoundException($"Bookmark with ID {bookmarkModelId} not found");
            }
            db.Bookmark.Remove(bookmark);
            await db.SaveChangesAsync();
        }

        public async Task<List<BookmarkViewModel>> List(int loginId)
        {
            return await List(loginId, bookmarkId: null);
        }

        private async Task<List<BookmarkViewModel>> List(int loginId, int? bookmarkId)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var bookmarks = await db.Bookmark
                .AsNoTracking()
                .Where(x => x.LoginId == loginId)
                .Where(x => bookmarkId == null || x.Id == bookmarkId)
                .OrderByDescending(x => x.Id)
                .ToListAsync();

            var reportIds = bookmarks
                .Where(x => x.BookmarkType == BookmarkTypeEnum.Report)
                .Select(x => x.ItemId)
                .Distinct()
                .ToList();
            var vulnerabilityIds = bookmarks
                .Where(x => x.BookmarkType == BookmarkTypeEnum.Vulnerability)
                .Select(x => x.ItemId)
                .Distinct()
                .ToList();

            var reports = await db.Report
                .AsNoTracking()
                .Where(x => reportIds.Contains(x.Id))
                .Select(x => new { x.Id, x.Name })
                .ToDictionaryAsync(x => x.Id);
            var vulnerabilities = await db.Vulnerability
                .AsNoTracking()
                .Where(x => vulnerabilityIds.Contains(x.Id))
                .Select(x => new { x.Id, x.Title, x.Description })
                .ToDictionaryAsync(x => x.Id);

            var res = new List<BookmarkViewModel>();
            foreach (var bookmark in bookmarks)
            {
                if (bookmark.BookmarkType == BookmarkTypeEnum.Report)
                {
                    if (!reports.TryGetValue(bookmark.ItemId, out var report))
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
                }
                else if (bookmark.BookmarkType == BookmarkTypeEnum.Vulnerability)
                {
                    if (!vulnerabilities.TryGetValue(bookmark.ItemId, out var vulnerability))
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
                else
                {
                    throw new Exception($"Invalid BookmarkType {bookmark.BookmarkType} for bookmark ID {bookmark.Id}");
                }
            }
            return res;
        }

    }

    public interface IBookmarkProcessor
    {
        Task<BookmarkModel> Get(int bookmarkModelId, int loginId);
        Task<BookmarkViewModel> GetViewModel(int bookmarkModelId, int loginId);
        Task<BookmarkViewModel> Add(BookmarkModel bookmarkModel);
        Task Delete(int bookmarkModelId, int loginId);
        Task<List<BookmarkViewModel>> List(int loginId);
    }
}

using AutoMapper;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;

namespace SorobanSecurityPortalApi.Services.ControllersServices
{
    public class BookmarkService : IBookmarkService
    {
        private readonly IBookmarkProcessor _bookmarkProcessor;
        private readonly UserContextAccessor _userContextAccessor;

        public BookmarkService(
            UserContextAccessor userContextAccessor,
            IBookmarkProcessor bookmarkProcessor)
        {
            _bookmarkProcessor = bookmarkProcessor;
            _userContextAccessor = userContextAccessor;
        }

        public async Task<BookmarkViewModel> Add(BookmarkModel bookmarkModel)
        {
            var userId = await _userContextAccessor.GetLoginIdAsync();
            // Set the LoginId from the authenticated user context
            bookmarkModel.LoginId = userId;
            return await _bookmarkProcessor.Add(bookmarkModel);
        }

        public async Task<List<BookmarkViewModel>> List()
        {
            return await _bookmarkProcessor.List();
        }

        public async Task Delete(int id)
        {
            var userId = await _userContextAccessor.GetLoginIdAsync();
            var bookmarkModel = await _bookmarkProcessor.Get(id);
            if (userId != bookmarkModel.LoginId)
            {
                throw new UnauthorizedAccessException("You do not have permission to delete a bookmark for this user.");
            }
            await _bookmarkProcessor.Delete(id);
        }
    }

    public interface IBookmarkService
    {
        Task<BookmarkViewModel> Add(BookmarkModel bookmark);
        Task<List<BookmarkViewModel>> List();
        Task Delete(int id);
    }
}

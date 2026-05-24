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
            var userId = await _userContextAccessor.GetLoginIdAsync();
            return await _bookmarkProcessor.List(userId);
        }

        public async Task<BookmarkViewModel> Get(int id)
        {
            var userId = await _userContextAccessor.GetLoginIdAsync();
            return await _bookmarkProcessor.GetViewModel(id, userId);
        }

        public async Task Delete(int id)
        {
            var userId = await _userContextAccessor.GetLoginIdAsync();
            await _bookmarkProcessor.Delete(id, userId);
        }
    }

    public interface IBookmarkService
    {
        Task<BookmarkViewModel> Add(BookmarkModel bookmark);
        Task<BookmarkViewModel> Get(int id);
        Task<List<BookmarkViewModel>> List();
        Task Delete(int id);
    }
}

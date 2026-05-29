using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.ViewModels;
using AutoMapper;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Common.Caching;

namespace SorobanSecurityPortalApi.Services.ControllersServices
{
    public class CategoryService : ICategoryService
    {
        private readonly IMapper _mapper;
        private readonly ICategoryProcessor _categoryProcessor;
        private readonly UserContextAccessor _userContextAccessor;
        private readonly ILookupCache _lookupCache;

        public CategoryService(
            IMapper mapper,
            ICategoryProcessor categoryProcessor,
            UserContextAccessor userContextAccessor,
            ILookupCache lookupCache)
        {
            _mapper = mapper;
            _categoryProcessor = categoryProcessor;
            _userContextAccessor = userContextAccessor;
            _lookupCache = lookupCache;
        }

        public async Task<CategoryViewModel> Add(CategoryViewModel categoryViewModel)
        {
            _lookupCache.Remove(LookupCacheKeys.Tags);
            var categoryModel = _mapper.Map<CategoryModel>(categoryViewModel);
            categoryModel.CreatedBy = await _userContextAccessor.GetLoginIdAsync();
            categoryModel.Date = DateTime.UtcNow;
            categoryModel = await _categoryProcessor.Add(categoryModel);
            return _mapper.Map<CategoryViewModel>(categoryModel);
        }

        // Returns a shared cached instance — callers must treat the result as read-only (do not mutate items).
        public async Task<List<CategoryViewModel>> List()
        {
            return await _lookupCache.GetOrCreateAsync(LookupCacheKeys.Tags, async () =>
            {
                var categories = await _categoryProcessor.List();
                return _mapper.Map<List<CategoryViewModel>>(categories);
            });
        }

        public async Task Delete(int id)
        {
            _lookupCache.Remove(LookupCacheKeys.Tags);
            await _categoryProcessor.Delete(id);
        }

        public async Task<CategoryViewModel> Update(CategoryViewModel categoryViewModel)
        {
            _lookupCache.Remove(LookupCacheKeys.Tags);
            var categoryModel = _mapper.Map<CategoryModel>(categoryViewModel);
            categoryModel = await _categoryProcessor.Update(categoryModel);
            return _mapper.Map<CategoryViewModel>(categoryModel);
        }
    }

    public interface ICategoryService
    {
        Task<CategoryViewModel> Add(CategoryViewModel categoryViewModel);
        Task<List<CategoryViewModel>> List();
        Task Delete(int id);
        Task<CategoryViewModel> Update(CategoryViewModel categoryViewModel);
    }
}

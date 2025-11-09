using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.ViewModels;
using AutoMapper;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Common;

namespace SorobanSecurityPortalApi.Services.ControllersServices
{
    public class CategoryService : ICategoryService
    {
        private readonly IMapper _mapper;
        private readonly ICategoryProcessor _categoryProcessor;
        private readonly UserContextAccessor _userContextAccessor;

        public CategoryService(
            IMapper mapper,
            ICategoryProcessor categoryProcessor,
            UserContextAccessor userContextAccessor)
        {
            _mapper = mapper;
            _categoryProcessor = categoryProcessor;
            _userContextAccessor = userContextAccessor;
        }

        public async Task<CategoryViewModel> Add(CategoryViewModel categoryViewModel)
        {
            var categoryModel = _mapper.Map<CategoryModel>(categoryViewModel);
            categoryModel.CreatedBy = await _userContextAccessor.GetLoginIdAsync();
            categoryModel.Date = DateTime.UtcNow;
            categoryModel = await _categoryProcessor.Add(categoryModel);
            return _mapper.Map<CategoryViewModel>(categoryModel);
        }

        public async Task<List<CategoryViewModel>> List()
        {
            var categorys = await _categoryProcessor.List();
            return _mapper.Map<List<CategoryViewModel>>(categorys);
        }

        public async Task Delete(int id)
        {
            await _categoryProcessor.Delete(id);
        }

        public async Task<CategoryViewModel> Update(CategoryViewModel categoryViewModel)
        {
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

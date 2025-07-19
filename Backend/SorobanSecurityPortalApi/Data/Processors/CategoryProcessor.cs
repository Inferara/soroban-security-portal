using Microsoft.EntityFrameworkCore;
using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Models.DbModels;

namespace SorobanSecurityPortalApi.Data.Processors
{
    public class CategoryProcessor : ICategoryProcessor
    {
        private readonly Db _db;

        public CategoryProcessor(Db db)
        {
            _db = db;
        }

        public async Task<CategoryModel> Add(CategoryModel categoryModel)
        {
            if (categoryModel == null)
            {
                throw new ArgumentNullException(nameof(categoryModel), "Category model cannot be null");
            }
            categoryModel.Date = DateTime.UtcNow;
            _db.Category.Add(categoryModel);
            await _db.SaveChangesAsync();
            return categoryModel;
        }

        public async Task<CategoryModel> Update(CategoryModel categoryModel)
        {
            if (categoryModel == null)
            {
                throw new ArgumentNullException(nameof(categoryModel), "Category model cannot be null");
            }
            var existingCategory = await _db.Category.FindAsync(categoryModel.Id);
            if (existingCategory == null)
            {
                throw new KeyNotFoundException($"Category with ID {categoryModel.Id} not found");
            }
            existingCategory.Name = categoryModel.Name;
            existingCategory.BgColor = categoryModel.BgColor;
            existingCategory.TextColor = categoryModel.TextColor;
            await _db.SaveChangesAsync();
            return existingCategory;
        }

        public async Task Delete(int categoryModelId)
        {
            var category = await _db.Category.FindAsync(categoryModelId);
            if (category == null)
            {
                throw new KeyNotFoundException($"Category with ID {categoryModelId} not found");
            }
            _db.Category.Remove(category);
            await _db.SaveChangesAsync();
        }

        public async Task<List<CategoryModel>> List()
        {
            return await _db.Category.OrderByDescending(x => x.Id).ToListAsync();
        }
    }

    public interface ICategoryProcessor
    {
        Task<CategoryModel> Add(CategoryModel categoryModel);
        Task<CategoryModel> Update(CategoryModel categoryModel);
        Task Delete(int categoryModelId);
        Task<List<CategoryModel>> List();
    }
}
using Microsoft.EntityFrameworkCore;
using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Models.DbModels;

namespace SorobanSecurityPortalApi.Data.Processors
{
    public class CategoryProcessor : ICategoryProcessor
    {
        private readonly IDbContextFactory<Db> _dbFactory;
        public CategoryProcessor(IDbContextFactory<Db> dbFactory)
        {
            _dbFactory = dbFactory;
        }

        public async Task<CategoryModel> Add(CategoryModel categoryModel)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            if (categoryModel == null)
            {
                throw new ArgumentNullException(nameof(categoryModel), "Category model cannot be null");
            }
            categoryModel.Date = DateTime.UtcNow;
            db.Category.Add(categoryModel);
            await db.SaveChangesAsync();
            return categoryModel;
        }

        public async Task<CategoryModel> Update(CategoryModel categoryModel)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            if (categoryModel == null)
            {
                throw new ArgumentNullException(nameof(categoryModel), "Category model cannot be null");
            }
            var existingCategory = await db.Category.FindAsync(categoryModel.Id);
            if (existingCategory == null)
            {
                throw new KeyNotFoundException($"Category with ID {categoryModel.Id} not found");
            }
            existingCategory.Name = categoryModel.Name;
            existingCategory.BgColor = categoryModel.BgColor;
            existingCategory.TextColor = categoryModel.TextColor;
            await db.SaveChangesAsync();
            return existingCategory;
        }

        public async Task Delete(int categoryModelId)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var category = await db.Category.FindAsync(categoryModelId);
            if (category == null)
            {
                throw new KeyNotFoundException($"Category with ID {categoryModelId} not found");
            }
            db.Category.Remove(category);
            await db.SaveChangesAsync();
        }

        public async Task<List<CategoryModel>> List()
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            return await db.Category.OrderByDescending(x => x.Id).ToListAsync();
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
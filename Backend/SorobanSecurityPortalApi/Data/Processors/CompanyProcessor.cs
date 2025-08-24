using Microsoft.EntityFrameworkCore;
using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Models.DbModels;

namespace SorobanSecurityPortalApi.Data.Processors
{
    public class CompanyProcessor : ICompanyProcessor
    {
        private readonly IDbContextFactory<Db> _dbFactory;

        public CompanyProcessor(IDbContextFactory<Db> dbFactory)
        {
            _dbFactory = dbFactory;
        }

        public async Task<CompanyModel> Add(CompanyModel companyModel)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            if (companyModel == null)
            {
                throw new ArgumentNullException(nameof(companyModel), "Company model cannot be null");
            }
            companyModel.Date = DateTime.UtcNow;
            db.Company.Add(companyModel);
            await db.SaveChangesAsync();
            return companyModel;
        }

        public async Task<CompanyModel> Update(CompanyModel companyModel)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            if (companyModel == null)
            {
                throw new ArgumentNullException(nameof(companyModel), "Company model cannot be null");
            }
            var existingCompany = await db.Company.FindAsync(companyModel.Id);
            if (existingCompany == null)
            {
                throw new KeyNotFoundException($"Company with ID {companyModel.Id} not found");
            }

            existingCompany.Name = companyModel.Name;
            existingCompany.Url = companyModel.Url;
            await db.SaveChangesAsync();
            return existingCompany;
        }

        public async Task Delete(int companyModelId)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var company = await db.Company.FindAsync(companyModelId);
            if (company == null)
            {
                throw new KeyNotFoundException($"Company with ID {companyModelId} not found");
            }
            db.Company.Remove(company);
            await db.SaveChangesAsync();
        }

        public async Task<List<CompanyModel>> List()
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            return await db.Company.OrderByDescending(x => x.Id).ToListAsync();
        }
    }

    public interface ICompanyProcessor
    {
        Task<CompanyModel> Add(CompanyModel companyModel);
        Task<CompanyModel> Update(CompanyModel companyModel);
        Task Delete(int companyModelId);
        Task<List<CompanyModel>> List();
    }
}
using Microsoft.EntityFrameworkCore;
using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Models.DbModels;

namespace SorobanSecurityPortalApi.Data.Processors
{
    public class CompanyProcessor : ICompanyProcessor
    {
        private readonly Db _db;

        public CompanyProcessor(Db db)
        {
            _db = db;
        }

        public async Task<CompanyModel> Add(CompanyModel companyModel)
        {
            if (companyModel == null)
            {
                throw new ArgumentNullException(nameof(companyModel), "Company model cannot be null");
            }
            companyModel.Date = DateTime.UtcNow;
            _db.Company.Add(companyModel);
            await _db.SaveChangesAsync();
            return companyModel;
        }

        public async Task<CompanyModel> Update(CompanyModel companyModel)
        {
            if (companyModel == null)
            {
                throw new ArgumentNullException(nameof(companyModel), "Company model cannot be null");
            }
            var existingCompany = await _db.Company.FindAsync(companyModel.Id);
            if (existingCompany == null)
            {
                throw new KeyNotFoundException($"Company with ID {companyModel.Id} not found");
            }

            // Update all Vulnerabilities where Company name matches the old name
            var vulnerabilitiesToUpdate = await _db.Vulnerability
                .Where(v => v.Company == existingCompany.Name)
                .ToListAsync();
            foreach (var vulnerability in vulnerabilitiesToUpdate)
            {
                vulnerability.Company = companyModel.Name;
            }
            // Update all Report where Company name matches the old name
            var reportsToUpdate = await _db.Report
                .Where(v => v.Company == existingCompany.Name)
                .ToListAsync();
            foreach (var report in reportsToUpdate)
            {
                report.Company = companyModel.Name;
            }

            existingCompany.Name = companyModel.Name;
            existingCompany.Url = companyModel.Url;
            await _db.SaveChangesAsync();
            return existingCompany;
        }

        public async Task Delete(int companyModelId)
        {
            var company = await _db.Company.FindAsync(companyModelId);
            if (company == null)
            {
                throw new KeyNotFoundException($"Company with ID {companyModelId} not found");
            }
            _db.Company.Remove(company);
            await _db.SaveChangesAsync();
        }

        public async Task<List<CompanyModel>> List()
        {
            return await _db.Company.OrderByDescending(x => x.Id).ToListAsync();
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
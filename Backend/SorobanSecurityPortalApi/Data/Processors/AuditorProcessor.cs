using Microsoft.EntityFrameworkCore;
using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Models.DbModels;

namespace SorobanSecurityPortalApi.Data.Processors
{
    public class AuditorProcessor : IAuditorProcessor
    {
        private readonly IDbContextFactory<Db> _dbFactory;

        public AuditorProcessor(IDbContextFactory<Db> dbFactory)
        {
            _dbFactory = dbFactory;
        }

        public async Task<AuditorModel> Add(AuditorModel auditorModel)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            if (auditorModel == null)
            {
                throw new ArgumentNullException(nameof(auditorModel), "Auditor model cannot be null");
            }
            auditorModel.Date = DateTime.UtcNow;
            db.Auditor.Add(auditorModel);
            await db.SaveChangesAsync();
            return auditorModel;
        }

        public async Task<AuditorModel> Update(AuditorModel auditorModel)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            if (auditorModel == null)
            {
                throw new ArgumentNullException(nameof(auditorModel), "Auditor model cannot be null");
            }
            var existingAuditor = await db.Auditor.FindAsync(auditorModel.Id);
            if (existingAuditor == null)
            {
                throw new KeyNotFoundException($"Auditor with ID {auditorModel.Id} not found");
            }
            // Update all Vulnerabilities where Auditor name matches the old name
            var vulnerabilitiesToUpdate = await db.Vulnerability
                .Where(v => v.Auditor == existingAuditor.Name)
                .ToListAsync();
            foreach (var vulnerability in vulnerabilitiesToUpdate)
            {
                vulnerability.Auditor = auditorModel.Name;
            }
            // Update all Report where Auditor name matches the old name
            var reportsToUpdate = await db.Report
                .Where(v => v.Auditor == existingAuditor.Name)
                .ToListAsync();
            foreach (var report in reportsToUpdate)
            {
                report.Auditor = auditorModel.Name;
            }

            existingAuditor.Name = auditorModel.Name;
            existingAuditor.Url = auditorModel.Url;
            await db.SaveChangesAsync();
            return existingAuditor;
        }

        public async Task Delete(int auditorModelId)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var auditor = await db.Auditor.FindAsync(auditorModelId);
            if (auditor == null)
            {
                throw new KeyNotFoundException($"Auditor with ID {auditorModelId} not found");
            }
            db.Auditor.Remove(auditor);
            await db.SaveChangesAsync();
        }

        public async Task<List<AuditorModel>> List()
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            return await db.Auditor.OrderByDescending(x => x.Id).ToListAsync();
        }
    }

    public interface IAuditorProcessor
    {
        Task<AuditorModel> Add(AuditorModel auditorModel);
        Task<AuditorModel> Update(AuditorModel auditorModel);
        Task Delete(int auditorModelId);
        Task<List<AuditorModel>> List();
    }
}
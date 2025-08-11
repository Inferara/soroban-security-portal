using Microsoft.EntityFrameworkCore;
using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Models.DbModels;

namespace SorobanSecurityPortalApi.Data.Processors
{
    public class AuditorProcessor : IAuditorProcessor
    {
        private readonly Db _db;

        public AuditorProcessor(Db db)
        {
            _db = db;
        }

        public async Task<AuditorModel> Add(AuditorModel auditorModel)
        {
            if (auditorModel == null)
            {
                throw new ArgumentNullException(nameof(auditorModel), "Auditor model cannot be null");
            }
            auditorModel.Date = DateTime.UtcNow;
            _db.Auditor.Add(auditorModel);
            await _db.SaveChangesAsync();
            return auditorModel;
        }

        public async Task<AuditorModel> Update(AuditorModel auditorModel)
        {
            if (auditorModel == null)
            {
                throw new ArgumentNullException(nameof(auditorModel), "Auditor model cannot be null");
            }
            var existingAuditor = await _db.Auditor.FindAsync(auditorModel.Id);
            if (existingAuditor == null)
            {
                throw new KeyNotFoundException($"Auditor with ID {auditorModel.Id} not found");
            }
            // Update all Vulnerabilities where Auditor name matches the old name
            var vulnerabilitiesToUpdate = await _db.Vulnerability
                .Where(v => v.Auditor == existingAuditor.Name)
                .ToListAsync();
            foreach (var vulnerability in vulnerabilitiesToUpdate)
            {
                vulnerability.Auditor = auditorModel.Name;
            }
            // Update all Report where Auditor name matches the old name
            var reportsToUpdate = await _db.Report
                .Where(v => v.Auditor == existingAuditor.Name)
                .ToListAsync();
            foreach (var report in reportsToUpdate)
            {
                report.Auditor = auditorModel.Name;
            }

            existingAuditor.Name = auditorModel.Name;
            existingAuditor.Url = auditorModel.Url;
            await _db.SaveChangesAsync();
            return existingAuditor;
        }

        public async Task Delete(int auditorModelId)
        {
            var auditor = await _db.Auditor.FindAsync(auditorModelId);
            if (auditor == null)
            {
                throw new KeyNotFoundException($"Auditor with ID {auditorModelId} not found");
            }
            _db.Auditor.Remove(auditor);
            await _db.SaveChangesAsync();
        }

        public async Task<List<AuditorModel>> List()
        {
            return await _db.Auditor.OrderByDescending(x => x.Id).ToListAsync();
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
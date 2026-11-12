using Microsoft.EntityFrameworkCore;
using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;

namespace SorobanSecurityPortalApi.Data.Processors
{
    // Read-only queries for the public surface. Two rules hold for everything here:
    //  - only content the public site shows: approved, not hidden, not deleted, not Invalid;
    //  - slim projections: never load PDFs, cover images or embeddings.
    public class PublicApiProcessor : IPublicApiProcessor
    {
        private readonly IDbContextFactory<Db> _dbFactory;

        public PublicApiProcessor(IDbContextFactory<Db> dbFactory)
        {
            _dbFactory = dbFactory;
        }

        public async Task<VulnerabilityModel?> GetVulnerability(int id)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            return await db.Vulnerability
                .AsNoTracking()
                .Where(v => v.Id == id
                            && v.Status == VulnerabilityModelStatus.Approved
                            && v.Category != VulnerabilityCategory.Invalid
                            && !v.IsHidden && !v.IsDeleted)
                .Select(v => new VulnerabilityModel
                {
                    Id = v.Id,
                    Severity = v.Severity,
                    Tags = v.Tags,
                    ReportId = v.ReportId,
                    ReportUrl = v.ReportUrl,
                    Title = v.Title,
                    Description = v.Description,
                    Date = v.Date,
                    Category = v.Category,
                    // A finding can outlive its report's visibility; never leak a hidden report's name.
                    Report = v.Report == null || v.Report.IsHidden || v.Report.IsDeleted || v.Report.Status != ReportModelStatus.Approved
                        ? null
                        : new ReportModel
                        {
                            Id = v.Report.Id,
                            Name = v.Report.Name,
                            Protocol = v.Report.Protocol == null ? null : new ProtocolModel
                            {
                                Id = v.Report.Protocol.Id,
                                Name = v.Report.Protocol.Name,
                                Company = v.Report.Protocol.Company == null ? null : new CompanyModel
                                {
                                    Id = v.Report.Protocol.Company.Id,
                                    Name = v.Report.Protocol.Company.Name,
                                },
                            },
                            Auditor = v.Report.Auditor == null ? null : new AuditorModel
                            {
                                Id = v.Report.Auditor.Id,
                                Name = v.Report.Auditor.Name,
                            },
                        },
                })
                .FirstOrDefaultAsync();
        }

        public async Task<ReportModel?> GetReport(int id, bool includeContent)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            return await db.Report
                .AsNoTracking()
                .Where(r => r.Id == id && r.Status == ReportModelStatus.Approved && !r.IsHidden && !r.IsDeleted)
                .Select(r => new ReportModel
                {
                    Id = r.Id,
                    Name = r.Name,
                    Date = r.Date,
                    MdFile = includeContent ? r.MdFile : "",
                    Protocol = r.Protocol == null ? null : new ProtocolModel
                    {
                        Id = r.Protocol.Id,
                        Name = r.Protocol.Name,
                        Company = r.Protocol.Company == null ? null : new CompanyModel
                        {
                            Id = r.Protocol.Company.Id,
                            Name = r.Protocol.Company.Name,
                        },
                    },
                    Auditor = r.Auditor == null ? null : new AuditorModel
                    {
                        Id = r.Auditor.Id,
                        Name = r.Auditor.Name,
                    },
                })
                .FirstOrDefaultAsync();
        }

        public async Task<Dictionary<string, int>> CountReportFindingsBySeverity(int reportId)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var groups = await db.Vulnerability
                .AsNoTracking()
                .Where(v => v.ReportId == reportId
                            && v.Status == VulnerabilityModelStatus.Approved
                            && v.Category != VulnerabilityCategory.Invalid
                            && v.Category != VulnerabilityCategory.NA
                            && !v.IsHidden && !v.IsDeleted)
                .GroupBy(v => v.Severity)
                .Select(g => new { Severity = g.Key, Count = g.Count() })
                .ToListAsync();
            // Severity is stored in mixed case ("High" / "high"); fold it here.
            return groups
                .GroupBy(g => (g.Severity ?? "").ToLowerInvariant())
                .ToDictionary(g => g.Key, g => g.Sum(x => x.Count));
        }

        public async Task<List<PublicProtocol>> ListProtocols()
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            return await db.Protocol
                .AsNoTracking()
                .OrderBy(p => p.Name)
                .Select(p => new PublicProtocol
                {
                    Id = p.Id,
                    Name = p.Name,
                    Website = p.Url,
                    Description = p.Description,
                    Company = p.Company == null ? null : new PublicRef { Id = p.Company.Id, Name = p.Company.Name },
                    ReportsCount = p.Reports.Count(r => r.Status == ReportModelStatus.Approved && !r.IsHidden && !r.IsDeleted),
                })
                .ToListAsync();
        }

        public async Task<List<PublicEntity>> ListAuditors()
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            return await db.Auditor
                .AsNoTracking()
                .OrderBy(a => a.Name)
                .Select(a => new PublicEntity
                {
                    Id = a.Id,
                    Name = a.Name,
                    Website = a.Url,
                    Description = a.Description,
                    ReportsCount = a.Reports.Count(r => r.Status == ReportModelStatus.Approved && !r.IsHidden && !r.IsDeleted),
                })
                .ToListAsync();
        }

        public async Task<List<PublicEntity>> ListCompanies()
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            return await db.Company
                .AsNoTracking()
                .OrderBy(c => c.Name)
                .Select(c => new PublicEntity
                {
                    Id = c.Id,
                    Name = c.Name,
                    Website = c.Url,
                    Description = c.Description,
                    ReportsCount = c.Protocols
                        .SelectMany(p => p.Reports)
                        .Count(r => r.Status == ReportModelStatus.Approved && !r.IsHidden && !r.IsDeleted),
                })
                .ToListAsync();
        }
    }

    public interface IPublicApiProcessor
    {
        Task<VulnerabilityModel?> GetVulnerability(int id);
        Task<ReportModel?> GetReport(int id, bool includeContent);
        Task<Dictionary<string, int>> CountReportFindingsBySeverity(int reportId);
        Task<List<PublicProtocol>> ListProtocols();
        Task<List<PublicEntity>> ListAuditors();
        Task<List<PublicEntity>> ListCompanies();
    }
}

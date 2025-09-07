using Microsoft.EntityFrameworkCore;
using Pgvector;
using Pgvector.EntityFrameworkCore;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Common.Extensions;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;
using static SorobanSecurityPortalApi.Common.ExceptionHandlingMiddleware;

namespace SorobanSecurityPortalApi.Data.Processors
{
    public class ReportProcessor : IReportProcessor
    {
        private readonly IDbContextFactory<Db> _dbFactory;
        private readonly ExtendedConfig _extendedConfig;

        public ReportProcessor(IDbContextFactory<Db> dbFactory, ExtendedConfig extendedConfig)
        {
            _dbFactory = dbFactory;
            _extendedConfig = extendedConfig;
        }

        public async Task<List<ReportModel>> Search(ReportSearchModel? reportSearch)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var q = db.Report
                .Include(v => v.Auditor)
                .Include(v => v.Protocol)
                .ThenInclude(p => p.Company)
                .AsNoTracking().Where(v => v.Status == ReportModelStatus.Approved);

            if (reportSearch != null)
            {
                if (reportSearch.From is not null)
                {
                    var from = DateTime.SpecifyKind(reportSearch.From.Value, DateTimeKind.Utc);
                    q = q.Where(v => v.Date >= from);
                }
                if (reportSearch.To is not null)
                {
                    var to = DateTime.SpecifyKind(reportSearch.To.Value, DateTimeKind.Utc);
                    q = q.Where(v => v.Date <= to);
                }
                if (!string.IsNullOrWhiteSpace(reportSearch.CompanyName))
                    q = q.Where(x => x.Protocol.Company.Name == reportSearch.CompanyName);

                if (!string.IsNullOrWhiteSpace(reportSearch.ProtocolName))
                    q = q.Where(x => x.Protocol.Name == reportSearch.ProtocolName);

                if (!string.IsNullOrWhiteSpace(reportSearch.AuditorName))
                    q = q.Where(x => x.Auditor.Name == reportSearch.AuditorName);

                // Build a single scoring expression
                if (!string.IsNullOrWhiteSpace(reportSearch.SearchText) || reportSearch.Embedding is not null)
                {
                    var searchText = reportSearch.SearchText ?? "";
                    var queryEmbedding = reportSearch.Embedding;

                    q = q
                        .Select(v => new
                        {
                            v,
                            TextScore =
                                (string.IsNullOrEmpty(searchText)
                                    ? 0.0
                                    : (TrigramExtensions.TrigramSimilarity(v.Name, searchText) * _extendedConfig.TrigramNameWeight 
                                       + TrigramExtensions.TrigramSimilarity(v.MdFile, searchText) * _extendedConfig.TrigramContentWeight)),
                            VecScore =
                                (queryEmbedding == null || v.Embedding == null)
                                    ? 0.0
                                    : (1.0 - v.Embedding.CosineDistance(queryEmbedding!)) * _extendedConfig.VectorContentWeight
                        })
                        .Where(x => _extendedConfig.MinRelevanceForSearch < (x.TextScore + x.VecScore))
                        .OrderByDescending(x => x.TextScore + x.VecScore)
                        .Select(x => x.v);
                }
                else if (!string.IsNullOrWhiteSpace(reportSearch.SortBy))
                {
                    q = reportSearch.SortBy switch
                    {
                        "date" => reportSearch.SortDirection == "asc" ? q.OrderBy(v => v.Date) : q.OrderByDescending(v => v.Date),
                        "name" => reportSearch.SortDirection == "asc" ? q.OrderBy(v => v.Name) : q.OrderByDescending(v => v.Name),
                        _ => throw new ArgumentException("Invalid sort by option")
                    };
                }
            }
            else
            {
                q = q.OrderByDescending(v => v.Id);
            }
            return await q
                .Select(v => new ReportModel
                {
                    Id = v.Id,
                    Name = v.Name,
                    Date = v.Date,
                    Status = v.Status,
                    Author = v.Author,
                    LastActionBy = v.LastActionBy,
                    LastActionAt = v.LastActionAt,
                    Auditor = v.Auditor,
                    Protocol = v.Protocol
                })
                .ToListAsync();
        }


        public async Task<ReportModel> Add(ReportModel reportModel)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            if (reportModel == null)
                throw new ArgumentNullException(nameof(reportModel));
            reportModel.Status = ReportModelStatus.New;
            db.Report.Add(reportModel);
            await db.SaveChangesAsync();
            return reportModel;
        }

        public async Task<ReportModel> Edit(ReportModel reportModel, string userName)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            if (reportModel.Id == 0) throw new ArgumentException("Identifier mustn't be zero");
            var existing = await db.Report.FirstAsync(item => item.Id == reportModel.Id);

            existing.Status = reportModel.Status;
            existing.Date = reportModel.Date;
            existing.Name = reportModel.Name;
            existing.ProtocolId = reportModel.ProtocolId;
            existing.AuditorId = reportModel.AuditorId;
            existing.LastActionBy = userName;
            existing.LastActionAt = DateTime.UtcNow;
            if(reportModel.BinFile is { Length: > 0 })
            {
                existing.BinFile = reportModel.BinFile;
                existing.Image = reportModel.Image;
                existing.MdFile = reportModel.MdFile;
            }
            db.Report.Update(existing);

            await db.SaveChangesAsync();
            return existing;
        }

        public async Task<ReportModel> Get(int reportId)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var report = await db.Report.AsNoTracking().FirstOrDefaultAsync(item => item.Id == reportId);
            if (report == null)
                throw new SorobanSecurityPortalUiException($"Report with ID {reportId} not found.");
            if (report.BinFile == null)
                report.BinFile = Array.Empty<byte>();
            return report;
        }

        public async Task Approve(ReportModel reportModel, string userName)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            reportModel.Status = ReportModelStatus.Approved;
            reportModel.LastActionBy = userName;
            reportModel.LastActionAt = DateTime.UtcNow;
            db.Report.Update(reportModel);
            await db.SaveChangesAsync();
        }

        public async Task Reject(ReportModel reportModel, string userName)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            reportModel.Status = ReportModelStatus.Rejected;
            reportModel.LastActionBy = userName;
            reportModel.LastActionAt = DateTime.UtcNow;
            db.Report.Update(reportModel);
            await db.SaveChangesAsync();
        }

        public async Task Remove(int reportId)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var existing = await db.Report.FirstAsync(item => item.Id == reportId);
            if (existing == null)
                return;
            db.Report.Remove(existing);
            await db.SaveChangesAsync();
        }

        public async Task<List<ReportModel>> GetList(bool includeNotApproved = false)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var query = db.Report
                .Include(r => r.Auditor)
                .Include(r => r.Protocol)
                .ThenInclude(p => p.Company)
                .AsNoTracking();
            if (!includeNotApproved)
            {
                query = query.Where(r => r.Status == ReportModelStatus.Approved);
            }
            query = query.Select(v => new ReportModel
            {
                Id = v.Id,
                Name = v.Name,
                Date = v.Date,
                Status = v.Status,
                Author = v.Author,
                LastActionBy = v.LastActionBy,
                LastActionAt = v.LastActionAt,
                Auditor = v.Auditor,
                Protocol = v.Protocol, 
            });
            query = query.OrderByDescending(v => v.Id);
            return await query.ToListAsync();
        }

        public async Task<List<ReportModel>> GetListForEmbedding()
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var query = db.Report
                .AsNoTracking()
                .Where(v => v.Embedding == null)
                .OrderByDescending(v => v.Id);
            return await query.ToListAsync();
        }

        public async Task<List<ReportModel>> GetListForFix()
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var query = db.Report
                .AsNoTracking()
                .Where(v => string.IsNullOrEmpty(v.MdFile) || v.MdFile == "Sequence contains no elements")
                .OrderByDescending(v => v.Id);
            return await query.ToListAsync();
        }

        public async Task UpdateEmbedding(int reportId, Vector embedding)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var existing = await db.Report.FirstAsync(item => item.Id == reportId);
            if (existing == null)
                throw new SorobanSecurityPortalUiException($"Report with ID {reportId} not found.");
            existing.Embedding = embedding;
            db.Report.Update(existing);
            await db.SaveChangesAsync();
        }

        public async Task UpdateMdFile(int reportId, string mdFile)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var existing = await db.Report.FirstAsync(item => item.Id == reportId);
            if (existing == null)
                throw new SorobanSecurityPortalUiException($"Report with ID {reportId} not found.");
            existing.MdFile = mdFile;
            db.Report.Update(existing);
            await db.SaveChangesAsync();
        }

        public async Task<ReportStatisticsChangesViewModel> GetStatisticsChanges()
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var ago = DateTime.UtcNow.AddMonths(-1);
            var newReports = await db.Report
                .AsNoTracking()
                .Where(v => v.Status == ReportModelStatus.Approved && v.Date >= ago)
                .CountAsync();
            return new ReportStatisticsChangesViewModel
            {
                Total = await db.Report
                    .AsNoTracking()
                    .CountAsync(v => v.Status == ReportModelStatus.Approved),
                New = newReports
            };
        }
    }

    public interface IReportProcessor
    {
        Task<List<ReportModel>> Search(ReportSearchModel reportSearch);
        Task<ReportModel> Add(ReportModel reportModel);
        Task<ReportModel> Edit(ReportModel reportModel, string userName);
        Task<ReportModel> Get(int reportId);
        Task Approve(ReportModel reportModel, string userName);
        Task Reject(ReportModel reportModel, string userName);
        Task Remove(int reportId);
        Task<List<ReportModel>> GetList(bool includeNotApproved = false);
        Task<List<ReportModel>> GetListForEmbedding();
        Task<List<ReportModel>> GetListForFix();
        Task UpdateEmbedding(int reportId, Vector embedding);
        Task UpdateMdFile(int reportId, string mdFile);
        Task<ReportStatisticsChangesViewModel> GetStatisticsChanges();
    }
}
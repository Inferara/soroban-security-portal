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
                .ThenInclude(p => p!.Company)
                .AsNoTracking().Where(v => v.Status == ReportModelStatus.Approved && !v.IsHidden && !v.IsDeleted);

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
                if (reportSearch.CompanyId is not null)
                    q = q.Where(x => x.Protocol != null && x.Protocol.Company != null && x.Protocol.Company.Id == reportSearch.CompanyId);
                else if (!string.IsNullOrWhiteSpace(reportSearch.CompanyName))
                    q = q.Where(x => x.Protocol != null && x.Protocol.Company != null && x.Protocol.Company.Name == reportSearch.CompanyName);
                if (reportSearch.ProtocolId is not null)
                    q = q.Where(x => x.Protocol != null && x.Protocol.Id == reportSearch.ProtocolId);
                else if (!string.IsNullOrWhiteSpace(reportSearch.ProtocolName))
                    q = q.Where(x => x.Protocol != null && x.Protocol.Name == reportSearch.ProtocolName);
                if (reportSearch.AuditorId is not null)
                    q = q.Where(x => x.Auditor != null && x.Auditor.Id == reportSearch.AuditorId);
                else if (!string.IsNullOrWhiteSpace(reportSearch.AuditorName))
                    q = q.Where(x => x.Auditor != null && x.Auditor.Name == reportSearch.AuditorName);

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
                    CreatedBy = v.CreatedBy,
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

        public async Task<ReportModel> Edit(ReportModel reportModel, int userId)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            if (reportModel.Id == 0) throw new ArgumentException("Identifier mustn't be zero");
            var existing = await db.Report.FirstAsync(item => item.Id == reportModel.Id);

            existing.Status = reportModel.Status;
            existing.Date = reportModel.Date;
            existing.Name = reportModel.Name;
            existing.ProtocolId = reportModel.ProtocolId;
            existing.AuditorId = reportModel.AuditorId;
            existing.LastActionBy = userId;
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
            var report = await db.Report
                .Include(r => r.Auditor)
                .Include(r => r.Protocol)
                .AsNoTracking()
                .FirstOrDefaultAsync(item => item.Id == reportId);
            if (report == null)
                throw new SorobanSecurityPortalUiException($"Report with ID {reportId} not found.");
            if (report.BinFile == null)
                report.BinFile = Array.Empty<byte>();
            return report;
        }

        // Public detail/image path: hidden/soft-deleted reports must never be served by direct URL.
        // Returns null (not throw) when missing/hidden/deleted so callers can map it to NotFound.
        // Approval-status is intentionally NOT filtered here; only the moderation flags are applied.
        public async Task<ReportModel?> GetPublic(int reportId)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var report = await db.Report
                .Include(r => r.Auditor)
                .Include(r => r.Protocol)
                .AsNoTracking()
                .FirstOrDefaultAsync(item => item.Id == reportId && !item.IsHidden && !item.IsDeleted);
            if (report == null)
                return null;
            if (report.BinFile == null)
                report.BinFile = Array.Empty<byte>();
            return report;
        }

        // Slim query for the public image endpoint: returns only the last-modified timestamp
        // (used to build the ETag/cache key) and never de-TOASTs the image/PDF bytes. Returns
        // null when the report is missing, hidden, soft-deleted, or has no image.
        public async Task<DateTime?> GetImageLastModified(int reportId)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            return await db.Report
                .AsNoTracking()
                .Where(r => r.Id == reportId && !r.IsHidden && !r.IsDeleted && r.Image != null)
                .Select(r => (DateTime?)r.LastActionAt)
                .FirstOrDefaultAsync();
        }

        // Slim query for the public image endpoint: selects ONLY the Image column, never the
        // PDF BinFile, MdFile or embedding. Applies the same moderation filter as GetImageLastModified.
        public async Task<byte[]?> GetImageBytes(int reportId)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            return await db.Report
                .AsNoTracking()
                .Where(r => r.Id == reportId && !r.IsHidden && !r.IsDeleted)
                .Select(r => r.Image)
                .FirstOrDefaultAsync();
        }

        // Slim query for the OG summary card: name + auditor name + status + last-modified only.
        // Never de-TOASTs Image/BinFile/MdFile/embedding. Applies the public moderation filter.
        public async Task<ReportSummaryMeta?> GetSummaryMeta(int reportId)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            return await db.Report
                .AsNoTracking()
                .Where(r => r.Id == reportId && !r.IsHidden && !r.IsDeleted)
                .Select(r => new ReportSummaryMeta(r.Name, r.Auditor != null ? r.Auditor.Name : null, r.Status, r.LastActionAt))
                .FirstOrDefaultAsync();
        }

        // Backfill helper: ids of reports that still have their source PDF, so their cover can be
        // re-rendered. Selects only the id; the BinFile != null check runs in SQL and never loads bytes.
        public async Task<List<int>> GetReportIdsWithBinFile()
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            return await db.Report
                .AsNoTracking()
                .Where(r => r.BinFile != null)
                .OrderBy(r => r.Id)
                .Select(r => r.Id)
                .ToListAsync();
        }

        // Backfill helper: replaces the stored cover and bumps LastActionAt so the image endpoint's
        // ETag and on-disk cache key (both derived from LastActionAt.Ticks) refresh.
        public async Task UpdateImage(int reportId, byte[] image)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var existing = await db.Report.FirstAsync(item => item.Id == reportId);
            existing.Image = image;
            existing.LastActionAt = DateTime.UtcNow;
            db.Report.Update(existing);
            await db.SaveChangesAsync();
        }

        public async Task Approve(ReportModel reportModel, int userId)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            reportModel.Status = ReportModelStatus.Approved;
            reportModel.LastActionBy = userId;
            reportModel.LastActionAt = DateTime.UtcNow;
            db.Report.Update(reportModel);
            await db.SaveChangesAsync();
        }

        public async Task Reject(ReportModel reportModel, int userId)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            reportModel.Status = ReportModelStatus.Rejected;
            reportModel.LastActionBy = userId;
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
                .ThenInclude(p => p!.Company)
                .AsNoTracking();
            if (!includeNotApproved)
            {
                query = query.Where(r => r.Status == ReportModelStatus.Approved && !r.IsHidden && !r.IsDeleted);
            }
            query = query.Select(v => new ReportModel
            {
                Id = v.Id,
                Name = v.Name,
                Date = v.Date,
                Status = v.Status,
                CreatedBy = v.CreatedBy,
                LastActionBy = v.LastActionBy,
                LastActionAt = v.LastActionAt,
                Auditor = v.Auditor,
                Protocol = v.Protocol, 
            });
            query = query.OrderByDescending(v => v.Id);
            return await query.ToListAsync();
        }

        public async Task<List<ReportModel>> GetListForSources()
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var query = db.Report
                .Include(r => r.Auditor)
                .Include(r => r.Protocol)
                .ThenInclude(p => p!.Company)
                .AsNoTracking()
                .Where(r => !r.IsHidden && !r.IsDeleted
                            && (r.Status == ReportModelStatus.Approved || r.Status == ReportModelStatus.New));
            return await query
                .Select(v => new ReportModel
                {
                    Id = v.Id,
                    Name = v.Name,
                    Date = v.Date,
                    Status = v.Status,
                    CreatedBy = v.CreatedBy,
                    LastActionBy = v.LastActionBy,
                    LastActionAt = v.LastActionAt,
                    Auditor = v.Auditor,
                    Protocol = v.Protocol,
                })
                .OrderByDescending(v => v.Id)
                .ToListAsync();
        }

        public async Task<List<ReportModel>> GetListForExamples()
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            return await db.Report
                .AsNoTracking()
                .Where(r => r.Status == ReportModelStatus.Approved && !r.IsHidden && !r.IsDeleted)
                .OrderByDescending(r => r.Id)
                .Select(r => new ReportModel { Id = r.Id, Name = r.Name, Status = r.Status, MdFile = r.MdFile })
                .ToListAsync();
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
                // Never regenerate the MdFile of an agent-ingested report — its MdFile is the agent's
                // article, not a placeholder. Explicit flag instead of relying on MdFile being non-empty.
                .Where(v => !v.IsAgentGenerated
                    && (string.IsNullOrEmpty(v.MdFile) || v.MdFile == "Sequence contains no elements"))
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
                .Where(v => v.Status == ReportModelStatus.Approved && !v.IsHidden && !v.IsDeleted && v.LastActionAt >= ago)
                .CountAsync();
            return new ReportStatisticsChangesViewModel
            {
                Total = await db.Report
                    .AsNoTracking()
                    .CountAsync(v => v.Status == ReportModelStatus.Approved && !v.IsHidden && !v.IsDeleted),
                New = newReports
            };
        }
    }

    public interface IReportProcessor
    {
        Task<List<ReportModel>> Search(ReportSearchModel reportSearch);
        Task<ReportModel> Add(ReportModel reportModel);
        Task<ReportModel> Edit(ReportModel reportModel, int userId);
        Task<ReportModel> Get(int reportId);
        Task<ReportModel?> GetPublic(int reportId);
        Task<DateTime?> GetImageLastModified(int reportId);
        Task<byte[]?> GetImageBytes(int reportId);
        Task<ReportSummaryMeta?> GetSummaryMeta(int reportId);
        Task Approve(ReportModel reportModel, int userId);
        Task Reject(ReportModel reportModel, int userId);
        Task Remove(int reportId);
        Task<List<ReportModel>> GetList(bool includeNotApproved = false);
        Task<List<ReportModel>> GetListForSources();
        Task<List<ReportModel>> GetListForExamples();
        Task<List<ReportModel>> GetListForEmbedding();
        Task<List<ReportModel>> GetListForFix();
        Task UpdateEmbedding(int reportId, Vector embedding);
        Task UpdateMdFile(int reportId, string mdFile);
        Task<List<int>> GetReportIdsWithBinFile();
        Task UpdateImage(int reportId, byte[] image);
        Task<ReportStatisticsChangesViewModel> GetStatisticsChanges();
    }
}
using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Models.DbModels;
using Microsoft.EntityFrameworkCore;
using SorobanSecurityPortalApi.Common.DataParsers;
using SorobanSecurityPortalApi.Common.Extensions;
using static SorobanSecurityPortalApi.Common.ExceptionHandlingMiddleware;

namespace SorobanSecurityPortalApi.Data.Processors
{
    public class ReportProcessor : IReportProcessor
    {
        private readonly Db _db;

        public ReportProcessor(Db db)
        {
            _db = db;
        }

        public async Task<List<ReportModel>> Search(ReportSearchModel? reportSearch)
        {
            var query = _db.Report.AsNoTracking().Where(v => v.Status == ReportModelStatus.Approved);

            if (reportSearch != null)
            {
                if (reportSearch.From != null)
                {
                    var from = DateTime.SpecifyKind(reportSearch.From.Value, DateTimeKind.Utc);
                    query = query.Where(v => v.Date > from);
                }
                if (reportSearch.To != null)
                {
                    var to = DateTime.SpecifyKind(reportSearch.To.Value, DateTimeKind.Utc);
                    query = query.Where(v => v.Date < to);
                }
                if (!string.IsNullOrEmpty(reportSearch.Project))
                {
                    query = query.Where(x => x.Project == reportSearch.Project);
                }
                if (!string.IsNullOrEmpty(reportSearch.Auditor))
                {
                    query = query.Where(x => x.Auditor == reportSearch.Auditor);
                }
                if (!string.IsNullOrEmpty(reportSearch.SearchText))
                {
                    query = query.OrderByDescending(v =>
                        TrigramExtensions.TrigramSimilarity(v.Name, reportSearch.SearchText) * 5 + TrigramExtensions.TrigramSimilarity(v.MdFile, reportSearch.SearchText));
                }
                if (!string.IsNullOrEmpty(reportSearch.SearchText))
                {
                    query = query.OrderByDescending(v =>
                        TrigramExtensions.TrigramSimilarity(v.Name, reportSearch.SearchText) * 5 + TrigramExtensions.TrigramSimilarity(v.MdFile, reportSearch.SearchText));
                }
                else if (reportSearch.SortBy != null)
                {
                    switch (reportSearch.SortBy)
                    {
                        case "date":
                            query = reportSearch.SortDirection == "asc" ? query.OrderBy(v => v.Date) : query.OrderByDescending(v => v.Date);
                            break;
                        case "name":
                            query = reportSearch.SortDirection == "asc" ? query.OrderBy(v => v.Name) : query.OrderByDescending(v => v.Name);
                            break;
                        default:
                            throw new ArgumentException("Invalid sort by option");
                    }
                }
            }
            else
            {
                query = query.OrderByDescending(v => v.Id);
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
                Project = v.Project,
            });
            return await query.ToListAsync();
        }

        public async Task<ReportModel> Add(ReportModel reportModel)
        {
            if (reportModel == null)
                throw new ArgumentNullException(nameof(reportModel));
            reportModel.Status = ReportModelStatus.New;
            _db.Report.Add(reportModel);
            await _db.SaveChangesAsync();
            return reportModel;
        }

        public async Task<ReportModel> Edit(ReportModel reportModel, string userName)
        {
            if (reportModel.Id == 0) throw new ArgumentException("Identifier mustn't be zero");
            var existing = await _db.Report.FirstAsync(item => item.Id == reportModel.Id);
            existing.Status = reportModel.Status;
            existing.Date = reportModel.Date;
            existing.Name = reportModel.Name;
            existing.Project = reportModel.Project;
            existing.Auditor = reportModel.Auditor;
            existing.LastActionBy = userName;
            existing.LastActionAt = DateTime.UtcNow;
            if(reportModel.BinFile is { Length: > 0 })
            {
                existing.BinFile = reportModel.BinFile;
                existing.Image = reportModel.Image;
                existing.MdFile = reportModel.MdFile;
            }
            _db.Report.Update(existing);
            await _db.SaveChangesAsync();
            return existing;
        }

        public async Task<ReportModel> Get(int reportId)
        {
            var report = await _db.Report.AsNoTracking().FirstOrDefaultAsync(item => item.Id == reportId);
            if (report == null)
                throw new SorobanSecurityPortalUiException($"Report with ID {reportId} not found.");
            if (report.BinFile == null)
                report.BinFile = Array.Empty<byte>();
            return report;
        }

        public async Task Approve(int reportId, string userName)
        {
            var existing = await _db.Report.FirstAsync(item => item.Id == reportId);
            existing.Status = ReportModelStatus.Approved;
            existing.LastActionBy = userName;
            existing.LastActionAt = DateTime.UtcNow;
            _db.Report.Update(existing);
            await _db.SaveChangesAsync();
        }

        public async Task Reject(int reportId, string userName)
        {
            var existing = await _db.Report.FirstAsync(item => item.Id == reportId);
            existing.Status = ReportModelStatus.Rejected;
            existing.LastActionBy = userName;
            existing.LastActionAt = DateTime.UtcNow;
            _db.Report.Update(existing);
            await _db.SaveChangesAsync();
        }

        public async Task Remove(int reportId)
        {
            var existing = await _db.Report.FirstAsync(item => item.Id == reportId);
            if (existing == null)
                return;
            _db.Report.Remove(existing);
            await _db.SaveChangesAsync();
        }

        public async Task<List<ReportModel>> GetList()
        {
            var query = _db.Report.AsNoTracking();
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
                Project = v.Project,
            });
            query = query.OrderByDescending(v => v.Id);
            return await query.ToListAsync();
        }
    }

    public interface IReportProcessor
    {
        Task<List<ReportModel>> Search(ReportSearchModel reportSearch);
        Task<ReportModel> Add(ReportModel reportModel);
        Task<ReportModel> Edit(ReportModel reportModel, string userName);
        Task<ReportModel> Get(int reportId);
        Task Approve(int reportId, string userName);
        Task Reject(int reportId, string userName);
        Task Remove(int reportId);
        Task<List<ReportModel>> GetList();
    }
}
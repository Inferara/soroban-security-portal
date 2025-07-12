using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Models.DbModels;
using Microsoft.EntityFrameworkCore;
using SorobanSecurityPortalApi.Common.Extensions;

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
            query = query.Select(v => new ReportModel
            {
                Id = v.Id,
                Name = v.Name,
                Image = v.Image,
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

        public async Task<byte[]> GetBinFile(int reportId)
        {
            var report = await _db.Report.AsNoTracking().FirstOrDefaultAsync(item => item.Id == reportId);
            if (report == null)
                throw new KeyNotFoundException($"Report with ID {reportId} not found.");
            return report.BinFile ?? Array.Empty<byte>();
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
            _db.Entry(existing).CurrentValues.SetValues(reportModel);
            existing.LastActionBy = userName;
            existing.LastActionAt = DateTime.UtcNow;
            _db.Report.Update(existing);
            await _db.SaveChangesAsync();
            return existing;
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
            return await _db.Report
                .AsNoTracking()
                .OrderByDescending(v => v.Id)
                .ToListAsync();
        }
    }

    public interface IReportProcessor
    {
        Task<List<ReportModel>> Search(ReportSearchModel reportSearch);
        Task<byte[]> GetBinFile(int reportId);
        Task<ReportModel> Add(ReportModel reportModel);
        Task<ReportModel> Edit(ReportModel reportModel, string userName);
        Task Approve(int reportId, string userName);
        Task Reject(int reportId, string userName);
        Task Remove(int reportId);
        Task<List<ReportModel>> GetList();
    }
}
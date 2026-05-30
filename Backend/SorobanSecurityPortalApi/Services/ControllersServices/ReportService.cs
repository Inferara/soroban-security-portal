using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.ViewModels;
using AutoMapper;
using Pgvector;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Common.Caching;
using SorobanSecurityPortalApi.Common.DataParsers;
using SorobanSecurityPortalApi.Models.DbModels;

namespace SorobanSecurityPortalApi.Services.ControllersServices
{
    public class ReportService : IReportService
    {
        private readonly IMapper _mapper;
        private readonly IReportProcessor _reportProcessor;
        private readonly UserContextAccessor _userContextAccessor;
        private readonly IGeminiEmbeddingService _embeddingService;
        private readonly ILookupCache _lookupCache;

        public ReportService(
            IMapper mapper,
            IReportProcessor reportProcessor,
            UserContextAccessor userContextAccessor,
            IGeminiEmbeddingService embeddingService,
            ILookupCache lookupCache)
        {
            _mapper = mapper;
            _reportProcessor = reportProcessor;
            _userContextAccessor = userContextAccessor;
            _embeddingService = embeddingService;
            _lookupCache = lookupCache;
        }

        public async Task<List<ReportViewModel>> Search(ReportSearchViewModel? reportSearchViewModel)
        {
            var reportSearchModel =  _mapper.Map<ReportSearchModel>(reportSearchViewModel);
            if (reportSearchModel != null && !string.IsNullOrEmpty(reportSearchModel.SearchText))
            {
                var embeddingArray = await _embeddingService.GenerateEmbeddingForDocumentAsync(reportSearchModel.SearchText);
                reportSearchModel.Embedding = new Vector(embeddingArray);
            }
            var searchResult = await _reportProcessor.Search(reportSearchModel!);
            var result = _mapper.Map<List<ReportViewModel>>(searchResult);
            return result;
        }

        public async Task<ReportViewModel> Get(int reportId)
        {
            var reportModel = await _reportProcessor.Get(reportId);
            var reportViewModel = _mapper.Map<ReportViewModel>(reportModel);
            return reportViewModel;
        }

        // Public detail/image path: excludes hidden/soft-deleted reports. Returns null when the
        // report is missing/hidden/deleted so the controller can return NotFound. The unfiltered
        // Get above is kept for the /download path (which has its own Approved check) and moderator flows.
        public async Task<ReportViewModel?> GetPublic(int reportId)
        {
            var reportModel = await _reportProcessor.GetPublic(reportId);
            if (reportModel == null)
                return null;
            return _mapper.Map<ReportViewModel>(reportModel);
        }

        //TODO UI should send Protocol and Auditor as Ids, not names. Then need to update the mapping used at the line 55
        public async Task<ReportViewModel> Add(ReportViewModel reportViewModel)
        {
            _lookupCache.Remove(LookupCacheKeys.Reports);
            _lookupCache.Remove(LookupCacheKeys.Sources);
            var reportModel = _mapper.Map<ReportModel>(reportViewModel);
            reportModel.Image = reportModel.BinFile != null ? ReportCoverImage.RenderCoverWebp(reportModel.BinFile) : null;
            reportModel.MdFile = reportModel.BinFile != null ? PdfToMarkdownConverter.ConvertToMarkdown(reportModel.BinFile) : string.Empty;
            var embeddingArray = await _embeddingService.GenerateEmbeddingForDocumentAsync(reportModel.MdFile ?? string.Empty);
            reportModel.Embedding = new Vector(embeddingArray);

            var addedReport = await _reportProcessor.Add(reportModel);
            return _mapper.Map<ReportViewModel>(addedReport);
        }

        public async Task<ReportViewModel> Update(ReportViewModel reportViewModel)
        {
            _lookupCache.Remove(LookupCacheKeys.Reports);
            _lookupCache.Remove(LookupCacheKeys.Sources);
            var reportModel = _mapper.Map<ReportModel>(reportViewModel);
            var loginId = await _userContextAccessor.GetLoginIdAsync();
            if (reportModel.BinFile != null && reportModel.BinFile.Length > 0)
            {
                reportModel.Image = ReportCoverImage.RenderCoverWebp(reportModel.BinFile);
                reportModel.MdFile = PdfToMarkdownConverter.ConvertToMarkdown(reportModel.BinFile);
                var embeddingArray = await _embeddingService.GenerateEmbeddingForDocumentAsync(reportModel.MdFile);
                reportModel.Embedding = new Vector(embeddingArray);
            }
            if (!await _userContextAccessor.IsLoginIdAdmin(loginId))
            {
                reportModel.Status = ReportModelStatus.New;
            }
            var updatedReport = await _reportProcessor.Edit(reportModel, loginId);
            return _mapper.Map<ReportViewModel>(updatedReport);
        }

        public async Task<Result<bool, string>> Approve(int reportId)
        {
            _lookupCache.Remove(LookupCacheKeys.Reports);
            _lookupCache.Remove(LookupCacheKeys.Sources);
            var reportModel = await _reportProcessor.Get(reportId);
            if (reportModel == null)
                return new Result<bool, string>.Err("Report not found.");
            var loginId = await _userContextAccessor.GetLoginIdAsync();
            if (!await CanApproveReport(reportModel, loginId))
                return new Result<bool, string>.Err("You cannot approve this report.");
            await _reportProcessor.Approve(reportModel, loginId);
            return new Result<bool, string>.Ok(true);
        }

        public async Task<Result<bool, string>> Reject(int reportId)
        {
            _lookupCache.Remove(LookupCacheKeys.Reports);
            _lookupCache.Remove(LookupCacheKeys.Sources);
            var loginId = await _userContextAccessor.GetLoginIdAsync();
            var reportModel = await _reportProcessor.Get(reportId);
            if (reportModel == null)
                return new Result<bool, string>.Err("Report not found.");
            if (! await CanRejectReport(reportModel, loginId))
                return new Result<bool, string>.Err("You cannot reject this report.");
            await _reportProcessor.Reject(reportModel, loginId);
            return new Result<bool, string>.Ok(true);
        }

        public async Task Remove(int reportId)
        {
            _lookupCache.Remove(LookupCacheKeys.Reports);
            _lookupCache.Remove(LookupCacheKeys.Sources);
            await _reportProcessor.Remove(reportId);
        }

        // The public (approved) list is a cacheable lookup; the admin "include everything" variant is uncached.
        public async Task<List<ReportViewModel>> GetList(bool includeNotApproved = false)
        {
            if (includeNotApproved)
            {
                var all = await _reportProcessor.GetList(true);
                return _mapper.Map<List<ReportViewModel>>(all);
            }
            return await _lookupCache.GetOrCreateAsync(LookupCacheKeys.Reports, async () =>
            {
                var reports = await _reportProcessor.GetList(false);
                return _mapper.Map<List<ReportViewModel>>(reports);
            });
        }

        public async Task<ReportStatisticsChangesViewModel> GetStatisticsChanges()
        {
            var stats = await _reportProcessor.GetStatisticsChanges();
            return _mapper.Map<ReportStatisticsChangesViewModel>(stats);
        }

        // One-time/idempotent maintenance: re-render every report cover that still has its source
        // PDF into the new compact WebP format. Processes one report at a time to avoid loading all
        // PDFs into memory. Per-report failures are counted, not fatal, so a single bad PDF cannot
        // abort the whole run; re-running is safe.
        public async Task<RecompressImagesResultViewModel> RecompressAllImages()
        {
            var result = new RecompressImagesResultViewModel();
            var ids = await _reportProcessor.GetReportIdsWithBinFile();
            foreach (var id in ids)
            {
                try
                {
                    var report = await _reportProcessor.Get(id);
                    if (report.BinFile == null || report.BinFile.Length == 0)
                    {
                        result.Skipped++;
                        continue;
                    }
                    result.BytesBefore += report.Image?.Length ?? 0;
                    var webp = ReportCoverImage.RenderCoverWebp(report.BinFile);
                    result.BytesAfter += webp.Length;
                    await _reportProcessor.UpdateImage(id, webp);
                    result.Processed++;
                }
                catch
                {
                    result.Failed++;
                    result.FailedIds.Add(id);
                }
            }
            return result;
        }

        private async Task<bool> CanApproveReport(ReportModel reportModel, int loginId)
        {
            return reportModel.CreatedBy != loginId || await _userContextAccessor.IsLoginIdAdmin(loginId);
        }

        private async Task<bool> CanRejectReport(ReportModel reportModel, int loginId)
        {
            return await _userContextAccessor.IsLoginIdAdmin(loginId) || reportModel.CreatedBy == loginId;
        }
    }

    public interface IReportService
    {
        Task<List<ReportViewModel>> Search(ReportSearchViewModel? reportSearch);
        Task<ReportViewModel> Get(int reportId);
        Task<ReportViewModel?> GetPublic(int reportId);
        Task<ReportViewModel> Add(ReportViewModel report);
        Task<ReportViewModel> Update(ReportViewModel report);
        Task<Result<bool, string>> Approve(int reportId);
        Task<Result<bool, string>> Reject(int vulnerabilityId);
        Task Remove(int reportId);
        Task<List<ReportViewModel>> GetList(bool includeNotApproved = false);
        Task<ReportStatisticsChangesViewModel> GetStatisticsChanges();
        Task<RecompressImagesResultViewModel> RecompressAllImages();
    }
}

using System.Runtime.Versioning;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.ViewModels;
using AutoMapper;
using PDFtoImage;
using Pgvector;
using SkiaSharp;
using SorobanSecurityPortalApi.Common;
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

        public ReportService(
            IMapper mapper,
            IReportProcessor reportProcessor,
            UserContextAccessor userContextAccessor,
            IGeminiEmbeddingService embeddingService)
        {
            _mapper = mapper;
            _reportProcessor = reportProcessor;
            _userContextAccessor = userContextAccessor;
            _embeddingService = embeddingService;
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

        //TODO UI should send Protocol and Auditor as Ids, not names. Then need to update the mapping used at the line 55
        [SupportedOSPlatform("windows")]
        [SupportedOSPlatform("linux")]
        [SupportedOSPlatform("macos")]
        public async Task<ReportViewModel> Add(ReportViewModel reportViewModel)
        {
            var reportModel = _mapper.Map<ReportModel>(reportViewModel);
            reportModel.Image = reportModel.BinFile != null ? RenderFirstPageAsPng(reportModel.BinFile, dpi: 150) : null;
            reportModel.MdFile = reportModel.BinFile != null ? PdfToMarkdownConverter.ConvertToMarkdown(reportModel.BinFile) : string.Empty;
            var embeddingArray = await _embeddingService.GenerateEmbeddingForDocumentAsync(reportModel.MdFile ?? string.Empty);
            reportModel.Embedding = new Vector(embeddingArray);

            var addedReport = await _reportProcessor.Add(reportModel);
            return _mapper.Map<ReportViewModel>(addedReport);
        }

        [SupportedOSPlatform("windows")]
        [SupportedOSPlatform("linux")]
        [SupportedOSPlatform("macos")]
        public async Task<ReportViewModel> Update(ReportViewModel reportViewModel)
        {
            var reportModel = _mapper.Map<ReportModel>(reportViewModel);
            var loginId = await _userContextAccessor.GetLoginIdAsync();
            if (reportModel.BinFile != null && reportModel.BinFile.Length > 0)
            {
                reportModel.Image = RenderFirstPageAsPng(reportModel.BinFile, dpi: 150);
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

        [SupportedOSPlatform("windows")]
        [SupportedOSPlatform("linux")]
        [SupportedOSPlatform("macos")]
        private static byte[] RenderFirstPageAsPng(byte[] file, int dpi = 150)
        {
            var bitmap = Conversion.ToImage(file, 0);
            using (var image = SKImage.FromBitmap(bitmap))
            using (var data = image.Encode(SKEncodedImageFormat.Png, 100))
            {
                return data.ToArray();
            }
        }

        public async Task<Result<bool, string>> Approve(int reportId)
        {
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
            await _reportProcessor.Remove(reportId);
        }

        public async Task<List<ReportViewModel>> GetList(bool includeNotApproved = false)
        {
            var reports = await _reportProcessor.GetList(includeNotApproved);
            return _mapper.Map<List<ReportViewModel>>(reports);
        }

        public async Task<ReportStatisticsChangesViewModel> GetStatisticsChanges()
        {
            var stats = await _reportProcessor.GetStatisticsChanges();
            return _mapper.Map<ReportStatisticsChangesViewModel>(stats);
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
        Task<ReportViewModel> Add(ReportViewModel report);
        Task<ReportViewModel> Update(ReportViewModel report);
        Task<Result<bool, string>> Approve(int reportId);
        Task<Result<bool, string>> Reject(int vulnerabilityId);
        Task Remove(int reportId);
        Task<List<ReportViewModel>> GetList(bool includeNotApproved = false);
        Task<ReportStatisticsChangesViewModel> GetStatisticsChanges();
    }
}

using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.ViewModels;
using AutoMapper;
using PDFtoImage;
using Pgvector;
using SkiaSharp;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Common.DataParsers;

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

        public async Task<List<ReportViewModel>> Search(ReportSearchViewModel? reportSearch)
        {
            var searchResult = await _reportProcessor.Search(_mapper.Map<Models.DbModels.ReportSearchModel>(reportSearch));
            var result = _mapper.Map<List<ReportViewModel>>(searchResult);
            return result;
        }

        public async Task<ReportViewModel> Get(int reportId)
        {
            var reportModel = await _reportProcessor.Get(reportId);
            var reportViewModel = _mapper.Map<ReportViewModel>(reportModel);
            return reportViewModel;
        }

        public async Task<ReportViewModel> Add(ReportViewModel reportViewModel)
        {
            var reportModel = _mapper.Map<Models.DbModels.ReportModel>(reportViewModel);
            reportModel.Image = RenderFirstPageAsPng(reportModel.BinFile, dpi: 150);
            reportModel.MdFile = PdfToMarkdownConverter.ConvertToMarkdown(reportModel.BinFile);
            var embeddingArray = await _embeddingService.GenerateEmbeddingForDocumentAsync(reportModel.MdFile);
            reportModel.Embedding = new Vector(embeddingArray);

            var addedReport = await _reportProcessor.Add(reportModel);
            return _mapper.Map<ReportViewModel>(addedReport);
        }

        public async Task<ReportViewModel> Update(ReportViewModel reportViewModel)
        {
            var reportModel = _mapper.Map<Models.DbModels.ReportModel>(reportViewModel);
            if (reportModel.BinFile != null && reportModel.BinFile.Length > 0)
            {
                reportModel.Image = RenderFirstPageAsPng(reportModel.BinFile, dpi: 150);
                reportModel.MdFile = PdfToMarkdownConverter.ConvertToMarkdown(reportModel.BinFile);
                var embeddingArray = await _embeddingService.GenerateEmbeddingForDocumentAsync(reportModel.MdFile);
                reportModel.Embedding = new Vector(embeddingArray);
            }
            var loginName = await _userContextAccessor.GetLoginNameAsync();
            var updatedReport = await _reportProcessor.Edit(reportModel, loginName);
            return _mapper.Map<ReportViewModel>(updatedReport);
        }

        private static byte[] RenderFirstPageAsPng(byte[] file, int dpi = 150)
        {
            var bitmap = Conversion.ToImage(file, 0);
            using (var image = SKImage.FromBitmap(bitmap))
            using (var data = image.Encode(SKEncodedImageFormat.Png, 100))
            {
                return data.ToArray();
            }
        }

        public async Task Approve(int reportId)
        {
            var loginName = await _userContextAccessor.GetLoginNameAsync();
            await _reportProcessor.Approve(reportId, loginName);
        }

        public async Task Reject(int reportId)
        {
            var loginName = await _userContextAccessor.GetLoginNameAsync();
            await _reportProcessor.Reject(reportId, loginName);
        }

        public async Task Remove(int reportId)
        {
            await _reportProcessor.Remove(reportId);
        }

        public async Task<List<ReportViewModel>> GetList()
        {
            var vulnerabilities = await _reportProcessor.GetList();
            return _mapper.Map<List<ReportViewModel>>(vulnerabilities);
        }
    }

    public interface IReportService
    {
        Task<List<ReportViewModel>> Search(ReportSearchViewModel? reportSearch);
        Task<ReportViewModel> Get(int reportId);
        Task<ReportViewModel> Add(ReportViewModel report);
        Task<ReportViewModel> Update(ReportViewModel report);
        Task Approve(int reportId);
        Task Reject(int vulnerabilityId);
        Task Remove(int reportId);
        Task<List<ReportViewModel>> GetList();

    }
}

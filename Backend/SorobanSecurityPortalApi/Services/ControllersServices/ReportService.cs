using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.ViewModels;
using AutoMapper;
using PDFtoImage;
using SkiaSharp;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Common.DataParsers;

namespace SorobanSecurityPortalApi.Services.ControllersServices
{
    public class ReportService : IReportService
    {
        private readonly IMapper _mapper;
        private readonly IReportProcessor _reportProcessor;
        private readonly UserContextAccessor _userContextAccessor;

        public ReportService(
            IMapper mapper,
            IReportProcessor reportProcessor,
            UserContextAccessor userContextAccessor)
        {
            _mapper = mapper;
            _reportProcessor = reportProcessor;
            _userContextAccessor = userContextAccessor;
        }

        public async Task<List<ReportViewModel>> Search(ReportSearchViewModel? reportSearch)
        {
            var searchResult = await _reportProcessor.Search(_mapper.Map<Models.DbModels.ReportSearchModel>(reportSearch));
            var result = _mapper.Map<List<ReportViewModel>>(searchResult);
            return result;
        }

        public async Task<byte[]> GetBinFile(int reportId)
        {
            return await _reportProcessor.GetBinFile(reportId);
        }

        public async Task<ReportViewModel> Add(ReportViewModel reportViewModel)
        {
            var reportModel = _mapper.Map<Models.DbModels.ReportModel>(reportViewModel);
            reportModel.Image = RenderFirstPageAsPng(reportModel.BinFile, dpi: 150);
            reportModel.MdFile = PdfToMarkdownConverter.ConvertToMarkdown(reportModel.BinFile);

            var addedReport = await _reportProcessor.Add(reportModel);
            return _mapper.Map<ReportViewModel>(addedReport);
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
        Task<byte[]> GetBinFile(int reportId);
        Task<ReportViewModel> Add(ReportViewModel report);
        Task Approve(int reportId);
        Task Reject(int vulnerabilityId);
        Task Remove(int reportId);
        Task<List<ReportViewModel>> GetList();

    }
}

using AutoMapper;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Caching.Memory;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Common.Caching;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Services.ControllersServices;

namespace SorobanSecurityPortalApi.Tests.Services
{
    public class ReportServiceRecompressTests
    {
        private static ReportService Build(Mock<IReportProcessor> processor) =>
            new ReportService(
                Mock.Of<IMapper>(),
                processor.Object,
                new UserContextAccessor(
                    Mock.Of<IHttpContextAccessor>(),
                    Mock.Of<ILoginProcessor>()),
                Mock.Of<IGeminiEmbeddingService>(),
                new LookupCache(new MemoryCache(new MemoryCacheOptions())));

        [Fact]
        public async Task RecompressAllImages_SkipsReportsWithEmptyBinFile()
        {
            var processor = new Mock<IReportProcessor>();
            processor.Setup(p => p.GetReportIdsWithBinFile())
                     .ReturnsAsync(new List<int> { 1 });
            processor.Setup(p => p.Get(1))
                     .ReturnsAsync(new ReportModel { Id = 1, BinFile = Array.Empty<byte>() });

            var svc = Build(processor);
            var result = await svc.RecompressAllImages();

            result.Skipped.Should().Be(1);
            result.Processed.Should().Be(0);
            result.Failed.Should().Be(0);
            processor.Verify(p => p.UpdateImage(It.IsAny<int>(), It.IsAny<byte[]>()), Times.Never);
        }

        [Fact]
        public async Task RecompressAllImages_CountsFailure_WhenRenderThrows()
        {
            // Non-PDF bytes: long enough that PDFtoImage cannot mistake them for anything valid.
            // RenderCoverWebp will throw, which the service catches and records as a failure.
            var garbage = new byte[256];
            for (int i = 0; i < garbage.Length; i++) garbage[i] = (byte)(i % 251);

            var processor = new Mock<IReportProcessor>();
            processor.Setup(p => p.GetReportIdsWithBinFile())
                     .ReturnsAsync(new List<int> { 2 });
            processor.Setup(p => p.Get(2))
                     .ReturnsAsync(new ReportModel { Id = 2, BinFile = garbage });

            var svc = Build(processor);
            var result = await svc.RecompressAllImages();

            result.Failed.Should().Be(1);
            result.FailedIds.Should().Contain(2);
            result.Processed.Should().Be(0);
            result.Skipped.Should().Be(0);
            processor.Verify(p => p.UpdateImage(It.IsAny<int>(), It.IsAny<byte[]>()), Times.Never);
        }

        [Fact]
        public async Task RecompressAllImages_EmptyList_ReturnsZeroes()
        {
            var processor = new Mock<IReportProcessor>();
            processor.Setup(p => p.GetReportIdsWithBinFile())
                     .ReturnsAsync(new List<int>());

            var svc = Build(processor);
            var result = await svc.RecompressAllImages();

            result.Processed.Should().Be(0);
            result.Skipped.Should().Be(0);
            result.Failed.Should().Be(0);
            result.FailedIds.Should().BeEmpty();
            processor.Verify(p => p.UpdateImage(It.IsAny<int>(), It.IsAny<byte[]>()), Times.Never);
        }
    }
}

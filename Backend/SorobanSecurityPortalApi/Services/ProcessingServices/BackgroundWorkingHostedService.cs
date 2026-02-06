using System.Runtime;
using Pgvector;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Common.DataParsers;
using SorobanSecurityPortalApi.Data.Processors;
using Microsoft.Extensions.DependencyInjection; 

namespace SorobanSecurityPortalApi.Services.ProcessingServices
{
    public class BackgroundWorkingHostedService : IHostedService
    {
        private readonly Config _config;
        private readonly IServiceScopeFactory _scopeFactory;

        public BackgroundWorkingHostedService(
            IServiceScopeFactory scopeFactory,
            Config config)
        {
            _scopeFactory = scopeFactory;
            _config = config;
        }

        public async Task StartAsync(CancellationToken cancellationToken)
        {
            // Note: Don't await the loop itself, or it will block the app from starting
            _ = Task.Run(async () =>
            {
                while (!cancellationToken.IsCancellationRequested)
                {
                    try 
                    {
                        using (var scope = _scopeFactory.CreateScope())
                        {
                            var reportProcessor = scope.ServiceProvider.GetRequiredService<IReportProcessor>();
                            var vulnerabilityProcessor = scope.ServiceProvider.GetRequiredService<IVulnerabilityProcessor>();
                            var embeddingService = scope.ServiceProvider.GetRequiredService<IGeminiEmbeddingService>();

                            AutoCompactLargeObjectHeap();
                            await DoReportsFix(reportProcessor);
                            await DoReportsEmbedding(reportProcessor, embeddingService);
                            await DoVulnerabilitiesEmbedding(vulnerabilityProcessor, embeddingService);
                        }
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"Background worker error: {ex.Message}");
                    }

                    await Task.Delay(TimeSpan.FromSeconds(10), cancellationToken);
                }
            }, cancellationToken);
        }

        private void AutoCompactLargeObjectHeap()
        {
            if (_config.AutoCompactLargeObjectHeap)
            {
                GCSettings.LargeObjectHeapCompactionMode = GCLargeObjectHeapCompactionMode.CompactOnce;
                GC.Collect();
            }
        }

        private async Task DoReportsFix(IReportProcessor reportProcessor)
        {
            var reports = await reportProcessor.GetListForFix();
            foreach (var reportModel in reports)
            {
                try
                {
                    if (reportModel.BinFile == null) continue;
                    reportModel.MdFile = PdfToMarkdownConverter.ConvertToMarkdown(reportModel.BinFile);
                    await reportProcessor.UpdateMdFile(reportModel.Id, reportModel.MdFile);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Error during report fix: {ex.Message}");
                }
            }
        }

        private async Task DoReportsEmbedding(IReportProcessor reportProcessor, IGeminiEmbeddingService embeddingService)
        {
            var reports = await reportProcessor.GetListForEmbedding();
            foreach (var reportModel in reports)
            {
                try
                {
                    var embeddingArray = await embeddingService.GenerateEmbeddingForDocumentAsync(reportModel.MdFile);
                    reportModel.Embedding = new Vector(embeddingArray);
                    await reportProcessor.UpdateEmbedding(reportModel.Id, reportModel.Embedding);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Error during report embedding: {ex.Message}");
                }
            }
        }

        private async Task DoVulnerabilitiesEmbedding(IVulnerabilityProcessor vulnerabilityProcessor, IGeminiEmbeddingService embeddingService)
        {
            var vulnerabilities = await vulnerabilityProcessor.GetListForEmbedding();
            foreach (var vulnerability in vulnerabilities)
            {
                try
                {
                    var embeddingArray = await embeddingService.GenerateEmbeddingForDocumentAsync(vulnerability.Description);
                    vulnerability.Embedding = new Vector(embeddingArray);
                    await vulnerabilityProcessor.UpdateEmbedding(vulnerability.Id, vulnerability.Embedding);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Error during vulnerability embedding: {ex.Message}");
                }
            }
        }

        public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
    }
}

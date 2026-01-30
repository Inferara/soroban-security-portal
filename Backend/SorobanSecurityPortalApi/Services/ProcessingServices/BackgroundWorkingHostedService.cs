using System.Runtime;
using Pgvector;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Common.DataParsers;
using SorobanSecurityPortalApi.Data.Processors;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace SorobanSecurityPortalApi.Services.ProcessingServices
{
    public class BackgroundWorkingHostedService : IHostedService
    {
        private readonly Config _config;
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<BackgroundWorkingHostedService> _logger;

        public BackgroundWorkingHostedService(
            IServiceScopeFactory scopeFactory,
            Config config,
            ILogger<BackgroundWorkingHostedService> logger)
        {
            _scopeFactory = scopeFactory;
            _config = config;
            _logger = logger;
        }

        public async Task StartAsync(CancellationToken cancellationToken)
        {
            _logger.LogInformation("Background worker service is starting.");

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
                        _logger.LogError(ex, "A critical error occurred in the background worker main loop.");
                    }

                    await Task.Delay(TimeSpan.FromSeconds(10), cancellationToken);
                }
            }, cancellationToken);

            await Task.CompletedTask;
        }

        private void AutoCompactLargeObjectHeap()
        {
            if (_config.AutoCompactLargeObjectHeap)
            {
                _logger.LogDebug("Compacting Large Object Heap.");
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
                    
                    _logger.LogInformation("Converting PDF to Markdown for Report {ReportId}", reportModel.Id);
                    reportModel.MdFile = PdfToMarkdownConverter.ConvertToMarkdown(reportModel.BinFile);
                    await reportProcessor.UpdateMdFile(reportModel.Id, reportModel.MdFile);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error during report fix for Report ID: {ReportId}", reportModel.Id);
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
                    _logger.LogInformation("Generating embedding for Report {ReportId}", reportModel.Id);
                    var embeddingArray = await embeddingService.GenerateEmbeddingForDocumentAsync(reportModel.MdFile);
                    reportModel.Embedding = new Vector(embeddingArray);
                    await reportProcessor.UpdateEmbedding(reportModel.Id, reportModel.Embedding);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error during report embedding for Report ID: {ReportId}", reportModel.Id);
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
                    _logger.LogInformation("Generating embedding for Vulnerability {VulnerabilityId}", vulnerability.Id);
                    var embeddingArray = await embeddingService.GenerateEmbeddingForDocumentAsync(vulnerability.Description);
                    vulnerability.Embedding = new Vector(embeddingArray);
                    await vulnerabilityProcessor.UpdateEmbedding(vulnerability.Id, vulnerability.Embedding);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error during vulnerability embedding for ID: {VulnerabilityId}", vulnerability.Id);
                }
            }
        }

        public Task StopAsync(CancellationToken cancellationToken)
        {
            _logger.LogInformation("Background worker service is stopping.");
            return Task.CompletedTask;
        }
    }
}

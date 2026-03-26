using System.Runtime;
using Pgvector;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Common.DataParsers;
using SorobanSecurityPortalApi.Data.Processors;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace SorobanSecurityPortalApi.Services.ProcessingServices
{
    public class BackgroundWorkingHostedService : BackgroundService
    {
        private readonly Config _config;
        private readonly IGeminiEmbeddingService _embeddingService;
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<BackgroundWorkingHostedService> _logger;

        public BackgroundWorkingHostedService(
            IGeminiEmbeddingService embeddingService,
            Config config,
            IServiceScopeFactory scopeFactory,
            ILogger<BackgroundWorkingHostedService> logger)
        {
            _embeddingService = embeddingService;
            _config = config;
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("Background worker service is starting.");

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    using (var scope = _scopeFactory.CreateScope())
                    {
                        var reportProcessor = scope.ServiceProvider.GetRequiredService<IReportProcessor>();
                        var vulnerabilityProcessor = scope.ServiceProvider.GetRequiredService<IVulnerabilityProcessor>();

                        await Task.Run(AutoCompactLargeObjectHeap, stoppingToken);
                        await DoReportsFix(reportProcessor);
                        await DoReportsEmbedding(reportProcessor);
                        await DoVulnerabilitiesEmbedding(vulnerabilityProcessor);
                    }

                    await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);
                }
                catch (OperationCanceledException)
                {
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error in background worker loop");
                    await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);
                }
            }

            _logger.LogInformation("Background worker service is stopping.");
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
            try
            {
                var reports = await reportProcessor.GetListForFix();
                foreach (var reportModel in reports)
                {
                    try
                    {
                        if (reportModel.BinFile == null)
                            continue;
                        reportModel.MdFile = PdfToMarkdownConverter.ConvertToMarkdown(reportModel.BinFile);
                        await reportProcessor.UpdateMdFile(reportModel.Id, reportModel.MdFile);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Error during report ({ReportName} / {ReportId}) fix", reportModel.Name, reportModel.Id);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching reports for fix");
            }
        }

        private async Task DoReportsEmbedding(IReportProcessor reportProcessor)
        {
            try
            {
                var reports = await reportProcessor.GetListForEmbedding();
                foreach (var reportModel in reports)
                {
                    try
                    {
                        var embeddingArray = await _embeddingService.GenerateEmbeddingForDocumentAsync(reportModel.MdFile);
                        reportModel.Embedding = new Vector(embeddingArray);
                        await reportProcessor.UpdateEmbedding(reportModel.Id, reportModel.Embedding);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Error during report ({ReportName} / {ReportId}) embedding", reportModel.Name, reportModel.Id);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching reports for embedding");
            }
        }

        private async Task DoVulnerabilitiesEmbedding(IVulnerabilityProcessor vulnerabilityProcessor)
        {
            try
            {
                var vulnerabilities = await vulnerabilityProcessor.GetListForEmbedding();
                foreach (var vulnerability in vulnerabilities)
                {
                    try
                    {
                        var embeddingArray = await _embeddingService.GenerateEmbeddingForDocumentAsync(vulnerability.Description);
                        vulnerability.Embedding = new Vector(embeddingArray);
                        await vulnerabilityProcessor.UpdateEmbedding(vulnerability.Id, vulnerability.Embedding);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Error during vulnerability ({VulnerabilityTitle} / {VulnerabilityId}) embedding", vulnerability.Title, vulnerability.Id);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching vulnerabilities for embedding");
            }
        }
    }
}
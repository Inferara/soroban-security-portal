using System.Runtime;
using Pgvector;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Common.DataParsers;
using SorobanSecurityPortalApi.Data.Processors;

namespace SorobanSecurityPortalApi.Services.ProcessingServices
{
    public class BackgroundWorkingHostedService : IHostedService
    {
        // A processing agent-run older than this with no result means the worker died mid-job; reclaim it.
        // Must exceed the worker's hard run cap (OPENCODE_TIMEOUT_MIN, default 20 min) plus slack.
        private static readonly TimeSpan StuckAgentRunTimeout = TimeSpan.FromMinutes(30);

        private readonly Config _config;
        private readonly IReportProcessor _reportProcessor;
        private readonly IVulnerabilityProcessor _vulnerabilityProcessor;
        private readonly IGeminiEmbeddingService _embeddingService;
        private readonly IAgentRunProcessor _agentRunProcessor;

        public BackgroundWorkingHostedService(
            IReportProcessor reportProcessor,
            IVulnerabilityProcessor vulnerabilityProcessor,
            IGeminiEmbeddingService embeddingService,
            IAgentRunProcessor agentRunProcessor,
            Config config)
        {
            _reportProcessor = reportProcessor;
            _vulnerabilityProcessor = vulnerabilityProcessor;
            _embeddingService = embeddingService;
            _agentRunProcessor = agentRunProcessor;
            _config = config;
        }

        public async Task StartAsync(CancellationToken cancellationToken)
        {
            while (!cancellationToken.IsCancellationRequested)
            {
                await Task.Run(AutoCompactLargeObjectHeap, cancellationToken);
                // Reaper runs FIRST so it isn't starved by the slow embedding steps below (which retry
                // with backoff when the embedding API is unavailable).
                await DoReclaimStuckAgentRuns();
                await DoReportsFix();
                await DoReportsEmbedding();
                await DoVulnerabilitiesEmbedding();
                await Task.Delay(TimeSpan.FromSeconds(10), cancellationToken);

            }
        }

        private async Task DoReclaimStuckAgentRuns()
        {
            try
            {
                var reclaimed = await _agentRunProcessor.ReclaimStuckProcessing(StuckAgentRunTimeout);
                if (reclaimed > 0)
                    Console.WriteLine($"Reclaimed {reclaimed} stuck agent run(s) (processing > {StuckAgentRunTimeout.TotalMinutes:0} min).");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error during stuck agent-run reclaim: {ex.Message}");
            }
        }

        private void AutoCompactLargeObjectHeap()
        {
            if (_config.AutoCompactLargeObjectHeap)
            {
                GCSettings.LargeObjectHeapCompactionMode = GCLargeObjectHeapCompactionMode.CompactOnce;
                GC.Collect();
            }
        }

        private async Task DoReportsFix()
        {
            var reports = await _reportProcessor.GetListForFix();
            foreach (var reportModel in reports)
            {
                try
                {
                    if(reportModel.BinFile == null)
                        continue;
                    reportModel.MdFile = PdfToMarkdownConverter.ConvertToMarkdown(reportModel.BinFile);
                    await _reportProcessor.UpdateMdFile(reportModel.Id, reportModel.MdFile);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Error during report ({reportModel.Name} / {reportModel.Id}) fix: {ex.Message}");
                }
            }
        }

        private async Task DoReportsEmbedding()
        {
            var reports = await _reportProcessor.GetListForEmbedding();
            foreach (var reportModel in reports)
            {
                try
                {
                    var embeddingArray = await _embeddingService.GenerateEmbeddingForDocumentAsync(reportModel.MdFile);
                    reportModel.Embedding = new Vector(embeddingArray);
                    await _reportProcessor.UpdateEmbedding(reportModel.Id, reportModel.Embedding);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Error during report ({reportModel.Name} / {reportModel.Id}) embedding: {ex.Message}");
                }
            }
        }

        private async Task DoVulnerabilitiesEmbedding()
        {
            var vulnerabilities = await _vulnerabilityProcessor.GetListForEmbedding();
            foreach (var vulnerability in vulnerabilities)
            {
                try
                {
                    var embeddingArray = await _embeddingService.GenerateEmbeddingForDocumentAsync(vulnerability.Description);
                    vulnerability.Embedding = new Vector(embeddingArray);
                    await _vulnerabilityProcessor.UpdateEmbedding(vulnerability.Id, vulnerability.Embedding);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Error during vulnerability ({vulnerability.Title} / {vulnerability.Id}) embedding: {ex.Message}");
                }
            }
        }

        public Task StopAsync(CancellationToken cancellationToken)
        {
            return Task.CompletedTask;
        }
    }
}
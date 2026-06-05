using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Services.Rendering;

namespace SorobanSecurityPortalApi.Services.ControllersServices
{
    public record ReportSummaryCardContent(byte[] Bytes, string ETag, DateTimeOffset LastModified);

    // Serves the report summary card PNG as a cached, rebuildable on-disk file keyed by the
    // stats signature. Returns null when the report is missing/unapproved.
    public class ReportSummaryCardService : IReportSummaryCardService
    {
        private readonly IReportSummaryService _summaryService;
        private readonly IReportSummaryCardRenderer _renderer;
        private readonly IExtendedConfig _config;

        public ReportSummaryCardService(
            IReportSummaryService summaryService,
            IReportSummaryCardRenderer renderer,
            IExtendedConfig config)
        {
            _summaryService = summaryService;
            _renderer = renderer;
            _config = config;
        }

        public async Task<ReportSummaryCardContent?> GetCardAsync(int reportId)
        {
            var stats = await _summaryService.GetStats(reportId);
            if (stats == null)
                return null;

            var etag = $"\"rsc{reportId}-{stats.Signature}\"";
            var lastModified = DateTimeOffset.UtcNow; // stable per-signature via the ETag; date is informational
            var path = CacheFilePath(reportId, stats.Signature);

            byte[]? bytes = null;
            if (File.Exists(path))
            {
                try { bytes = await File.ReadAllBytesAsync(path); }
                catch (IOException) { bytes = null; }
            }

            if (bytes == null || bytes.Length == 0)
            {
                bytes = _renderer.Render(stats);
                WriteAtomic(path, bytes);
            }

            return new ReportSummaryCardContent(bytes, etag, lastModified);
        }

        public async Task<string?> GetETagAsync(int reportId)
        {
            var stats = await _summaryService.GetStats(reportId);
            return stats == null ? null : $"\"rsc{reportId}-{stats.Signature}\"";
        }

        private string CacheFilePath(int reportId, string signature)
        {
            var dir = _config.ReportImageCacheDir;
            Directory.CreateDirectory(dir);
            // Filename is the integer id + hex signature only -> no path traversal.
            return Path.Combine(dir, $"report-summary-{reportId}-{signature}.png");
        }

        private static void WriteAtomic(string path, byte[] bytes)
        {
            var tmp = $"{path}.{Guid.NewGuid():N}.tmp";
            try
            {
                File.WriteAllBytes(tmp, bytes);
                File.Move(tmp, path, overwrite: true);
            }
            catch (IOException)
            {
                // Another request materialized the same file concurrently; that copy is fine.
            }
            finally
            {
                if (File.Exists(tmp))
                {
                    try { File.Delete(tmp); } catch (IOException) { }
                }
            }
        }
    }

    public interface IReportSummaryCardService
    {
        Task<ReportSummaryCardContent?> GetCardAsync(int reportId);
        Task<string?> GetETagAsync(int reportId);
    }
}

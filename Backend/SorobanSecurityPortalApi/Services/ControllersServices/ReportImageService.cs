using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Data.Processors;

namespace SorobanSecurityPortalApi.Services.ControllersServices
{
    public record ReportImageMeta(string ETag, DateTimeOffset LastModified);
    public record ReportImageContent(byte[] Bytes, string ETag, DateTimeOffset LastModified);

    // Serves report cover images as static-like cached files. The DB row stays the source of
    // truth; this layer (a) never reads the heavy PDF/markdown/embedding columns and (b) keeps a
    // rebuildable on-disk copy keyed by the report id + last-modified ticks, so repeat requests
    // are served from disk instead of the database.
    public class ReportImageService : IReportImageService
    {
        private readonly IReportProcessor _reportProcessor;
        private readonly IExtendedConfig _config;

        public ReportImageService(IReportProcessor reportProcessor, IExtendedConfig config)
        {
            _reportProcessor = reportProcessor;
            _config = config;
        }

        public async Task<ReportImageMeta?> GetImageMetaAsync(int reportId)
        {
            var lastModified = await _reportProcessor.GetImageLastModified(reportId);
            if (lastModified == null)
                return null;
            return BuildMeta(reportId, lastModified.Value);
        }

        public async Task<ReportImageContent?> GetImageContentAsync(int reportId)
        {
            var lastModified = await _reportProcessor.GetImageLastModified(reportId);
            if (lastModified == null)
                return null;

            var meta = BuildMeta(reportId, lastModified.Value);
            var path = CacheFilePath(reportId, lastModified.Value);

            byte[]? bytes = null;
            if (File.Exists(path))
            {
                try { bytes = await File.ReadAllBytesAsync(path); }
                catch (IOException) { bytes = null; }
            }

            if (bytes == null || bytes.Length == 0)
            {
                bytes = await _reportProcessor.GetImageBytes(reportId);
                if (bytes == null || bytes.Length == 0)
                    return null;
                WriteAtomic(path, bytes);
            }

            return new ReportImageContent(bytes, meta.ETag, meta.LastModified);
        }

        private static ReportImageMeta BuildMeta(int reportId, DateTime lastModified)
        {
            var utc = DateTime.SpecifyKind(lastModified, DateTimeKind.Utc);
            return new ReportImageMeta($"\"r{reportId}-{utc.Ticks}\"", new DateTimeOffset(utc));
        }

        private string CacheFilePath(int reportId, DateTime lastModified)
        {
            var dir = _config.ReportImageCacheDir;
            Directory.CreateDirectory(dir);
            var utc = DateTime.SpecifyKind(lastModified, DateTimeKind.Utc);
            // Filename is built only from the integer id and numeric ticks -> no path traversal.
            return Path.Combine(dir, $"report-{reportId}-{utc.Ticks}.png");
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

    public interface IReportImageService
    {
        Task<ReportImageMeta?> GetImageMetaAsync(int reportId);
        Task<ReportImageContent?> GetImageContentAsync(int reportId);
    }
}

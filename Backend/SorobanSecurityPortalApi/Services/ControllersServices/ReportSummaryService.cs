using System.Security.Cryptography;
using System.Text;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;

namespace SorobanSecurityPortalApi.Services.ControllersServices
{
    // Computes the vulnerability stats shown on the OG summary card. Mirrors the on-page
    // report card (report-details.tsx): Fixed = category Valid, NotFixed = everything else.
    public class ReportSummaryService : IReportSummaryService
    {
        private readonly IReportService _reportService;
        private readonly IVulnerabilityService _vulnerabilityService;

        public ReportSummaryService(IReportService reportService, IVulnerabilityService vulnerabilityService)
        {
            _reportService = reportService;
            _vulnerabilityService = vulnerabilityService;
        }

        public async Task<ReportSummaryStats?> GetStats(int reportId)
        {
            var meta = await _reportService.GetSummaryMeta(reportId);
            if (meta == null || meta.Status != ReportModelStatus.Approved)
                return null;

            // Same query the report page uses (hidden/soft-deleted already excluded). PageSize -1
            // returns all rows; descriptions are skipped (not needed for counts).
            var vulns = await _vulnerabilityService.Search(new VulnerabilitySearchViewModel
            {
                Reports = new List<string> { meta.Name },
                PageSize = -1,
                IncludeDescription = false
            });

            var total = vulns.Count;
            var fixedCount = vulns.Count(v => v.Category == VulnerabilityCategory.Valid);
            var notFixed = total - fixedCount;
            var rate = total > 0 ? (int)Math.Round((double)fixedCount / total * 100) : 0;

            var signature = BuildSignature(reportId, meta, total, fixedCount, notFixed);
            return new ReportSummaryStats(meta.Name, meta.AuditorName, total, fixedCount, notFixed, rate, signature);
        }

        // Short, stable hash of everything the rendered card depends on -> used as cache/ETag key.
        private static string BuildSignature(int reportId, ReportSummaryMeta meta, int total, int fixedCount, int notFixed)
        {
            var raw = $"{reportId}|{meta.LastActionAt.Ticks}|{total}|{fixedCount}|{notFixed}|{meta.AuditorName}|{meta.Name}";
            var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(raw));
            return Convert.ToHexString(bytes, 0, 8).ToLowerInvariant(); // 16 hex chars
        }
    }

    public interface IReportSummaryService
    {
        Task<ReportSummaryStats?> GetStats(int reportId);
    }
}

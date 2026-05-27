using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Services.ControllersServices;

namespace SorobanSecurityPortalApi.Controllers
{
    // Server-rendered OpenGraph/Twitter meta for social link-preview crawlers, which do not
    // execute JavaScript and therefore never see the SPA's client-side tags. The UI nginx routes
    // known crawler User-Agents on /vulnerability/{id} and /report/{id} to these endpoints.
    [ApiController]
    [Route("api/v1/og")]
    public class OgController : ControllerBase
    {
        private const string SiteName = "Soroban Security Portal";
        private const string GenericDescription = "Soroban security portal - audits, reports, and vulnerabilities.";
        private const int MaxDescriptionLength = 160;

        private readonly IVulnerabilityService _vulnerabilityService;
        private readonly IReportService _reportService;
        private readonly Config _config;
        private readonly IPageViewService _pageViewService;

        public OgController(IVulnerabilityService vulnerabilityService, IReportService reportService, Config config, IPageViewService pageViewService)
        {
            _vulnerabilityService = vulnerabilityService;
            _reportService = reportService;
            _config = config;
            _pageViewService = pageViewService;
        }

        // Config.AppUrl is "https://<domain>/api/v1"; the public site base is that minus "/api/v1".
        private string SiteBase => (_config.AppUrl ?? string.Empty).Replace("/api/v1", string.Empty).TrimEnd('/');
        private string LogoUrl => $"{SiteBase}/static/images/logo.png";

        [HttpGet("vulnerability/{id:int}")]
        public async Task<IActionResult> Vulnerability(int id)
        {
            var pageUrl = $"{SiteBase}/vulnerability/{id}";
            var v = await _vulnerabilityService.Get(id);
            // Reuse the public Get (already excludes hidden/soft-deleted) and additionally require
            // the content to be approved & valid before emitting rich tags, so the OG path never
            // exposes more than a published detail page.
            if (v == null || v.Status != VulnerabilityModelStatus.Approved || v.Category == VulnerabilityCategory.Invalid)
                return Generic(pageUrl);

            await RecordCrawlerView(EntityType.Vulnerability, id);
            return Page(v.Title, Truncate(v.Description, MaxDescriptionLength), LogoUrl, pageUrl);
        }

        [HttpGet("report/{id:int}")]
        public async Task<IActionResult> Report(int id)
        {
            var pageUrl = $"{SiteBase}/report/{id}";
            var r = await _reportService.Get(id);
            if (r == null || r.Status != ReportModelStatus.Approved)
                return Generic(pageUrl);

            var image = (r.Image != null && r.Image.Length > 0)
                ? $"{_config.AppUrl}/reports/{id}/image.png"
                : LogoUrl;
            await RecordCrawlerView(EntityType.Report, id);
            return Page(r.Name, $"Security audit report: {r.Name}", image, pageUrl);
        }

        // Records a crawler/link-preview hit. Best-effort: a failure here must never break the
        // OpenGraph response that social crawlers depend on.
        private async Task RecordCrawlerView(EntityType entityType, int id)
        {
            try
            {
                var ua = Request.Headers.UserAgent.ToString();
                await _pageViewService.RecordView(entityType, id, Request.GetClientIp(), ua, PageViewSource.Crawler);
            }
            catch
            {
                // swallow — analytics must not affect link previews
            }
        }

        private IActionResult Generic(string pageUrl) =>
            Content(BuildHtml(SiteName, GenericDescription, LogoUrl, pageUrl), "text/html; charset=utf-8");

        private IActionResult Page(string title, string description, string image, string pageUrl) =>
            Content(BuildHtml(title, description, image, pageUrl), "text/html; charset=utf-8");

        private static string Truncate(string? s, int max)
        {
            if (string.IsNullOrWhiteSpace(s)) return GenericDescription;
            s = s.Trim();
            return s.Length <= max ? s : s.Substring(0, max).TrimEnd() + "…";
        }

        private string BuildHtml(string title, string description, string image, string url)
        {
            string E(string x) => WebUtility.HtmlEncode(x);
            var t = E(title);
            var d = E(description);
            var img = E(image);
            var u = E(url);
            var redirectJs = JsonSerializer.Serialize(url); // safe JS string literal

            var sb = new StringBuilder();
            sb.Append("<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\">");
            sb.Append($"<title>{t} | {SiteName}</title>");
            sb.Append($"<meta name=\"description\" content=\"{d}\">");
            sb.Append("<meta property=\"og:type\" content=\"article\">");
            sb.Append($"<meta property=\"og:title\" content=\"{t}\">");
            sb.Append($"<meta property=\"og:description\" content=\"{d}\">");
            sb.Append($"<meta property=\"og:image\" content=\"{img}\">");
            sb.Append($"<meta property=\"og:url\" content=\"{u}\">");
            sb.Append($"<meta property=\"og:site_name\" content=\"{SiteName}\">");
            sb.Append("<meta name=\"twitter:card\" content=\"summary_large_image\">");
            sb.Append($"<meta name=\"twitter:title\" content=\"{t}\">");
            sb.Append($"<meta name=\"twitter:description\" content=\"{d}\">");
            sb.Append($"<meta name=\"twitter:image\" content=\"{img}\">");
            sb.Append($"<link rel=\"canonical\" href=\"{u}\">");
            sb.Append($"<meta http-equiv=\"refresh\" content=\"0; url={u}\">");
            sb.Append("</head><body>");
            sb.Append($"<script>window.location.replace({redirectJs});</script>");
            sb.Append($"<p>Redirecting to <a href=\"{u}\">{t}</a></p>");
            sb.Append("</body></html>");
            return sb.ToString();
        }
    }
}

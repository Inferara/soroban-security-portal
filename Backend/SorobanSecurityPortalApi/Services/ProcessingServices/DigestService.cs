using System.Text;
using Microsoft.EntityFrameworkCore;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Models.DbModels;

namespace SorobanSecurityPortalApi.Services.ProcessingServices
{
    public interface IDigestService
    {
        Task ProcessDigestsAsync();
    }

    public class DigestService : IDigestService
    {
        private readonly Db _db;
        private readonly IEmailService _emailService;
        private readonly Config _config;
        private readonly ILogger<DigestService> _logger;

        public DigestService(Db db, IEmailService emailService, Config config, ILogger<DigestService> logger)
        {
            _db = db;
            _emailService = emailService;
            _config = config;
            _logger = logger;
        }

        public async Task ProcessDigestsAsync()
        {
            var oneWeekAgo = DateTime.UtcNow.AddDays(-7);

            var users = await _db.UserProfiles
                .Include(u => u.Login)
                .Where(u => u.ReceiveWeeklyDigest && u.Login.IsEnabled)
                .ToListAsync();

            foreach (var user in users)
            {
                if (user.LastDigestSentAt.HasValue && user.LastDigestSentAt.Value > DateTime.UtcNow.AddDays(-6))
                    continue;

                var userId = user.Login?.LoginId ?? 0; 
                if (userId == 0) continue;

                var userSubs = await _db.Subscription
                    .Where(s => s.UserId == userId)
                    .ToListAsync();

                if (!userSubs.Any()) 
                    continue;

                // Explicit IDs
                var followedProtocolIds = userSubs
                    .Where(s => s.ProtocolId.HasValue)
                    .Select(s => s.ProtocolId.Value)
                    .ToList();

                var followedCategoryIds = userSubs
                    .Where(s => s.CategoryId.HasValue)
                    .Select(s => s.CategoryId.Value)
                    .ToList();

                // --- FETCH CONTENT ---

                var newReports = new List<ReportModel>();
                if (followedProtocolIds.Any())
                {
                    newReports = await _db.Report
                        .Where(r => r.Date > oneWeekAgo 
                                    && r.ProtocolId.HasValue 
                                    && followedProtocolIds.Contains(r.ProtocolId.Value))
                        .OrderByDescending(r => r.Date)
                        .Take(5)
                        .ToListAsync();
                }

                var newVulns = new List<VulnerabilityModel>();
                if (followedProtocolIds.Any())
                {
                    newVulns = await _db.Vulnerability
                        .Include(v => v.Report)
                        .Where(v => v.Date > oneWeekAgo 
                                    && v.Report != null 
                                    && v.Report.ProtocolId.HasValue
                                    && followedProtocolIds.Contains(v.Report.ProtocolId.Value))
                        .OrderByDescending(v => v.Date)
                        .Take(5)
                        .ToListAsync();
                }

                var newThreads = new List<ForumThreadModel>();
                if (followedCategoryIds.Any())
                {
                    newThreads = await _db.ForumThread
                        .Where(t => t.CreatedAt > oneWeekAgo 
                                    && followedCategoryIds.Contains(t.CategoryId))
                        .OrderByDescending(t => t.ViewCount)
                        .Take(3)
                        .ToListAsync();
                }

                if (!newReports.Any() && !newVulns.Any() && !newThreads.Any()) 
                    continue;

                await SendDigestToUser(user, newReports, newVulns, newThreads);
            }
        }

        private async Task SendDigestToUser(UserProfileModel user, List<ReportModel> reports, List<VulnerabilityModel> vulns, List<ForumThreadModel> threads)
        {
            try
            {
                string displayName = !string.IsNullOrEmpty(user.Login.FullName) ? user.Login.FullName : "User";
                
                string body = BuildEmailHtml(displayName, reports, vulns, threads);
                await _emailService.SendEmailAsync(user.Login.Email, "Weekly Soroban Security Update", body);
                
                user.LastDigestSentAt = DateTime.UtcNow;
                user.UpdatedAt = DateTime.UtcNow;
                await _db.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                // Isolate errors per user
                _logger.LogError(ex, $"Failed to send digest to user {user.Login?.LoginId}");
            }
        }

        private string BuildEmailHtml(string name, List<ReportModel> reports, List<VulnerabilityModel> vulns, List<ForumThreadModel> threads)
        {
            var sb = new StringBuilder();
            sb.Append($"<h2>Hello {name},</h2>");
            sb.Append("<p>Here are the updates for the entities you follow.</p>");

            if (reports.Any())
            {
                sb.Append("<h3>New Audit Reports</h3><ul>");
                foreach (var r in reports)
                    sb.Append($"<li><strong>{r.Name}</strong> ({r.Date:MMM dd})</li>");
                sb.Append("</ul>");
            }

            if (vulns.Any())
            {
                sb.Append("<h3>New Vulnerabilities</h3><ul>");
                foreach (var v in vulns)
                    sb.Append($"<li><strong>{v.Title}</strong> - Severity: {v.Severity}</li>");
                sb.Append("</ul>");
            }

            if (threads.Any())
            {
                sb.Append("<h3>Top Discussions</h3><ul>");
                foreach (var t in threads)
                    sb.Append($"<li><strong>{t.Title}</strong> ({t.ViewCount} views)</li>");
                sb.Append("</ul>");
            }

            var settingsUrl = $"{_config.FrontendUrl}/settings/notifications";
            sb.Append("<hr/>");
            sb.Append($"<p><small>You are receiving this because you subscribed to updates. <a href='{settingsUrl}'>Unsubscribe here</a>.</small></p>");
            
            return sb.ToString();
        }
    }
}
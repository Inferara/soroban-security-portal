using System.Text;
using Microsoft.EntityFrameworkCore;
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
        private readonly ILogger<DigestService> _logger;

        public DigestService(Db db, IEmailService emailService, ILogger<DigestService> logger)
        {
            _db = db;
            _emailService = emailService;
            _logger = logger;
        }

        public async Task ProcessDigestsAsync()
        {
            // 1. Fetch Global Content (New in the last 7 days)
            var oneWeekAgo = DateTime.UtcNow.AddDays(-7);

            var newReports = await _db.Report
                .Where(r => r.Date > oneWeekAgo)
                .OrderByDescending(r => r.Date)
                .Take(5)
                .ToListAsync();

            // Fetch new Vulnerabilities
            var newVulns = await _db.Vulnerability
                .Where(v => v.Date > oneWeekAgo) 
                .OrderByDescending(v => v.Date)
                .Take(5)
                .ToListAsync();

            // Fetch Top Forum Threads
            var topThreads = await _db.ForumThread
                .Where(t => t.CreatedAt > oneWeekAgo)
                .OrderByDescending(t => t.ViewCount)
                .Take(3)
                .ToListAsync();

            // 2. If no new content, stop (save resources)
            if (!newReports.Any() && !newVulns.Any() && !topThreads.Any())
            {
                _logger.LogInformation("Weekly Digest: No new content to send.");
                return;
            }

            // 3. Get Users who opted-in
            var users = await _db.UserProfiles
                .Include(u => u.Login)
                .Where(u => u.ReceiveWeeklyDigest && u.Login.IsEnabled)
                .ToListAsync();

            // 4. Send Emails
            foreach (var user in users)
            {
                // Skip if sent recently (prevents spam on restart)
                if (user.LastDigestSentAt.HasValue && user.LastDigestSentAt.Value > DateTime.UtcNow.AddDays(-6))
                    continue;

                await SendDigestToUser(user, newReports, newVulns, topThreads);
            }
        }

        private async Task SendDigestToUser(UserProfileModel user, List<ReportModel> reports, List<VulnerabilityModel> vulns, List<ForumThreadModel> threads)
        {
            try
            {
                string body = BuildEmailHtml(user.Login.FullName ?? "User", reports, vulns, threads);

                await _emailService.SendEmailAsync(user.Login.Email, "Weekly Soroban Security Update", body);

                if (_db.Entry(user).State == EntityState.Detached) 
                    _db.UserProfiles.Attach(user);
                
                user.LastDigestSentAt = DateTime.UtcNow;
                user.UpdatedAt = DateTime.UtcNow;
                await _db.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Failed to send digest to user {user.LoginId}");
            }
        }

        private string BuildEmailHtml(string name, List<ReportModel> reports, List<VulnerabilityModel> vulns, List<ForumThreadModel> threads)
        {
            var sb = new StringBuilder();
            sb.Append($"<h2>Hello {name},</h2>");
            sb.Append("<p>Here is what happened this week on the Soroban Security Portal.</p>");

            if (reports.Any())
            {
                sb.Append("<h3> New Audit Reports</h3><ul>");
                foreach (var r in reports)
                    sb.Append($"<li><strong>{r.Name}</strong> ({r.Date:MMM dd})</li>");
                sb.Append("</ul>");
            }

            if (vulns.Any())
            {
                sb.Append("<h3> New Vulnerabilities</h3><ul>");
                foreach (var v in vulns)
                    sb.Append($"<li><strong>{v.Title}</strong> - Severity: {v.Severity}</li>");
                sb.Append("</ul>");
            }

            if (threads.Any())
            {
                sb.Append("<h3> Trending Discussions</h3><ul>");
                foreach (var t in threads)
                    sb.Append($"<li><strong>{t.Title}</strong></li>");
                sb.Append("</ul>");
            }

            sb.Append("<hr/><p><small>To unsubscribe, update your profile settings.</small></p>");
            return sb.ToString();
        }
    }
}
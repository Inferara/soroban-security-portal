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
            // 1. Find users who want the digest
            var users = await _db.UserProfiles
                .Include(u => u.Login)
                .Where(u => u.ReceiveWeeklyDigest && u.Login.IsEnabled)
                .ToListAsync();

            var oneWeekAgo = DateTime.UtcNow.AddDays(-7);

            foreach (var user in users)
            {
                // Skip if sent recently (within 6 days) to avoid duplicate sends if service restarts
                if (user.LastDigestSentAt.HasValue && user.LastDigestSentAt.Value > DateTime.UtcNow.AddDays(-6))
                    continue;

                await ProcessSingleUserDigest(user, oneWeekAgo);
            }
        }

        private async Task ProcessSingleUserDigest(UserProfileModel user, DateTime since)
        {
            try
            {
                // 2. Get Subscriptions
                var subscriptions = await _db.Subscription
                    .Where(s => s.UserId == user.LoginId)
                    .ToListAsync();

                if (!subscriptions.Any()) return;
                var followedCompanyIds = subscriptions
                    .Where(s => s.EntityType == EntityType.Company) 
                    .Select(s => s.EntityId)
                    .ToList();

                // 3. Aggregate Data
                
                var newReports = await _db.Report
                    .Where(r => followedCompanyIds.Contains(r.CompanyId) && r.Created > since)
                    .OrderByDescending(r => r.Created)
                    .Take(5)
                    .ToListAsync();

                var newVulns = await _db.Vulnerability
                    .Where(v => followedCompanyIds.Contains(v.CompanyId) && v.Created > since)
                    .OrderByDescending(v => v.Created)
                    .Take(5)
                    .ToListAsync();

                var topThreads = await _db.ForumThread
                    .Where(t => t.CreatedAt > since)
                    .OrderByDescending(t => t.ViewCount)
                    .Take(3)
                    .ToListAsync();

                // 4. Check if content exists
                if (!newReports.Any() && !newVulns.Any() && !topThreads.Any())
                    return;

                // 5. Build HTML
                string body = BuildEmailHtml(user.Login.FullName ?? "User", newReports, newVulns, topThreads);

                // 6. Send
                await _emailService.SendEmailAsync(user.Login.Email, "Your Weekly Soroban Security Digest", body);

                // 7. Update User Profile 
                _db.UserProfiles.Attach(user);
                user.LastDigestSentAt = DateTime.UtcNow;
                user.UpdatedAt = DateTime.UtcNow;
                await _db.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Failed to process digest for user {user.LoginId}");
            }
        }

        private string BuildEmailHtml(string name, List<ReportModel> reports, List<VulnerabilityModel> vulns, List<ForumThreadModel> threads)
        {
            var sb = new StringBuilder();
            sb.Append($"<h2>Hello {name},</h2>");
            sb.Append("<p>Here is your weekly summary of activity on the Soroban Security Portal.</p>");

            if (reports.Any())
            {
                sb.Append("<h3> New Audit Reports</h3><ul>");
                foreach (var r in reports)
                    sb.Append($"<li><strong>{r.Title}</strong> ({r.Created:MMM dd})</li>");
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

            sb.Append("<hr/><p><small>To unsubscribe, visit your profile settings.</small></p>");
            return sb.ToString();
        }
    }
}
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Models.DbModels;

namespace SorobanSecurityPortalApi.Services.ControllersServices
{
    public class ReputationService : IReputationService
    {
        private readonly IDbContextFactory<Db> _dbFactory;
        private readonly ILogger<ReputationService> _logger;

        // Point values
        private const int PointsCommentUpvote = 5;
        private const int PointsCommentDownvote = -2;
        private const int PointsReportApproved = 25;
        private const int PointsRatingPosted = 10;

        // Vulnerability points
        private const int PointsVulnerabilityCritical = 50;
        private const int PointsVulnerabilityHigh = 30;
        private const int PointsVulnerabilityMedium = 15;
        private const int PointsVulnerabilityLow = 5;

        public ReputationService(IDbContextFactory<Db> dbFactory, ILogger<ReputationService> logger)
        {
            _dbFactory = dbFactory;
            _logger = logger;
        }

        public async Task AwardCommentUpvoteAsync(int userId)
        {
            await UpdateReputationAsync(userId, PointsCommentUpvote, "comment_upvote_received");
        }

        public async Task DeductCommentDownvoteAsync(int userId)
        {
            await UpdateReputationAsync(userId, PointsCommentDownvote, "comment_downvote_received");
        }

        public async Task AwardReportApprovalAsync(int userId)
        {
            await UpdateReputationAsync(userId, PointsReportApproved, "report_approved");
        }

        public async Task AwardVulnerabilityAddedAsync(int userId, string severity)
        {
            var points = GetVulnerabilityPoints(severity);
            await UpdateReputationAsync(userId, points, $"vulnerability_added_{severity.ToLowerInvariant()}");
        }

        public async Task AwardRatingPostedAsync(int userId)
        {
            await UpdateReputationAsync(userId, PointsRatingPosted, "rating_posted");
        }

        public async Task RecalculateUserReputationAsync(int userId)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();

            // Get user profile or create if doesn't exist
            var userProfile = await db.UserProfiles
                .FirstOrDefaultAsync(up => up.LoginId == userId);

            if (userProfile == null)
            {
                // Create user profile if it doesn't exist
                userProfile = new UserProfileModel
                {
                    LoginId = userId,
                    ReputationScore = 0,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                db.UserProfiles.Add(userProfile);
                await db.SaveChangesAsync();
            }

            // Calculate reputation from all contributions
            int totalReputation = 0;

            // Reports approved
            var approvedReports = await db.Report
                .Where(r => r.CreatedBy == userId && r.Status == ReportModelStatus.Approved)
                .CountAsync();
            totalReputation += approvedReports * PointsReportApproved;

            // Vulnerabilities added (by severity)
            var vulnerabilities = await db.Vulnerability
                .Where(v => v.CreatedBy == userId && v.Status == VulnerabilityModelStatus.Approved)
                .ToListAsync();

            foreach (var vuln in vulnerabilities)
            {
                totalReputation += GetVulnerabilityPoints(vuln.Severity);
            }

            // TODO: Comments and ratings are not yet implemented in the system
            // When implemented, include in the recalculation:
            // - Count comment upvotes/downvotes
            // - Count ratings posted

            // Update reputation
            var oldReputation = userProfile.ReputationScore;
            userProfile.ReputationScore = totalReputation;
            userProfile.UpdatedAt = DateTime.UtcNow;

            // Log the recalculation
            if (oldReputation != totalReputation)
            {
                var history = new ReputationHistoryModel
                {
                    UserId = userId,
                    PointsChange = totalReputation - oldReputation,
                    NewReputation = totalReputation,
                    Reason = "recalculation",
                    CreatedAt = DateTime.UtcNow
                };
                db.ReputationHistory.Add(history);
            }

            db.UserProfiles.Update(userProfile);
            await db.SaveChangesAsync();

            _logger.LogInformation("Recalculated reputation for user {UserId}: {OldReputation} -> {NewReputation}", 
                userId, oldReputation, totalReputation);
        }

        public async Task RecalculateAllUsersReputationAsync()
        {
            await using var db = await _dbFactory.CreateDbContextAsync();

            // Get all users who have created reports or vulnerabilities
            var userIds = await db.Report
                .Select(r => r.CreatedBy)
                .Union(db.Vulnerability.Select(v => v.CreatedBy))
                .Distinct()
                .ToListAsync();

            _logger.LogInformation("Starting reputation recalculation for {Count} users", userIds.Count);

            foreach (var userId in userIds)
            {
                try
                {
                    await RecalculateUserReputationAsync(userId);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error recalculating reputation for user {UserId}", userId);
                }
            }

            _logger.LogInformation("Completed reputation recalculation for {Count} users", userIds.Count);
        }

        private async Task UpdateReputationAsync(int userId, int pointsChange, string reason)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();

            // Get or create user profile
            var userProfile = await db.UserProfiles
                .FirstOrDefaultAsync(up => up.LoginId == userId);

            if (userProfile == null)
            {
                userProfile = new UserProfileModel
                {
                    LoginId = userId,
                    ReputationScore = 0,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                db.UserProfiles.Add(userProfile);
                await db.SaveChangesAsync();
            }

            var oldReputation = userProfile.ReputationScore;
            userProfile.ReputationScore += pointsChange;
            userProfile.UpdatedAt = DateTime.UtcNow;

            // Log the change
            var history = new ReputationHistoryModel
            {
                UserId = userId,
                PointsChange = pointsChange,
                NewReputation = userProfile.ReputationScore,
                Reason = reason,
                CreatedAt = DateTime.UtcNow
            };

            db.ReputationHistory.Add(history);
            db.UserProfiles.Update(userProfile);
            await db.SaveChangesAsync();

            _logger.LogInformation("Updated reputation for user {UserId}: {OldReputation} -> {NewReputation} ({Reason})", 
                userId, oldReputation, userProfile.ReputationScore, reason);
        }

        private static int GetVulnerabilityPoints(string severity)
        {
            return severity.ToLowerInvariant() switch
            {
                VulnerabilitySeverity.Critical => PointsVulnerabilityCritical,
                VulnerabilitySeverity.High => PointsVulnerabilityHigh,
                VulnerabilitySeverity.Medium => PointsVulnerabilityMedium,
                VulnerabilitySeverity.Low => PointsVulnerabilityLow,
                _ => 0
            };
        }
    }
}


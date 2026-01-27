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


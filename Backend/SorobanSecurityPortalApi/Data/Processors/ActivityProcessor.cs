using Microsoft.EntityFrameworkCore;
using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;

namespace SorobanSecurityPortalApi.Data.Processors
{
    public class ActivityProcessor : IActivityProcessor
    {
        private readonly IDbContextFactory<Db> _dbFactory;

        public ActivityProcessor(IDbContextFactory<Db> dbFactory)
        {
            _dbFactory = dbFactory;
        }

        public async Task<int> Add(ActivityModel activity)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            db.Activity.Add(activity);
            await db.SaveChangesAsync();
            return activity.Id;
        }

        public async Task<List<ActivityViewModel>> GetRecentActivities(int hours, int limit, int? loginId = null)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            
            var cutoffTime = DateTime.UtcNow.AddHours(-hours);
            var query = db.Activity
                .Where(a => a.CreatedAt >= cutoffTime)
                .OrderByDescending(a => a.CreatedAt)
                .Take(limit);

            var activities = await query.ToListAsync();
            var result = new List<ActivityViewModel>();

            foreach (var activity in activities)
            {
                var viewModel = await EnrichActivity(db, activity);
                if (viewModel != null)
                {
                    result.Add(viewModel);
                }
            }

            return result;
        }

        public async Task<List<ActivityViewModel>> GetPersonalizedActivities(int loginId, int hours, int limit)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            
            // Get user's followed entities
            var follows = await db.UserFollow
                .Where(f => f.LoginId == loginId)
                .ToListAsync();

            var followedProtocols = follows.Where(f => f.EntityType == FollowEntityType.Protocol).Select(f => f.EntityId).ToHashSet();
            var followedAuditors = follows.Where(f => f.EntityType == FollowEntityType.Auditor).Select(f => f.EntityId).ToHashSet();
            var followedCompanies = follows.Where(f => f.EntityType == FollowEntityType.Company).Select(f => f.EntityId).ToHashSet();

            var cutoffTime = DateTime.UtcNow.AddHours(-hours);
            var allActivities = await db.Activity
                .Where(a => a.CreatedAt >= cutoffTime)
                .OrderByDescending(a => a.CreatedAt)
                .ToListAsync();

            var enrichedActivities = new List<(ActivityViewModel vm, bool isFollowed)>();

            foreach (var activity in allActivities)
            {
                var viewModel = await EnrichActivity(db, activity);
                if (viewModel != null)
                {
                    bool isFollowed = false;
                    
                    if (viewModel.ProtocolId.HasValue && followedProtocols.Contains(viewModel.ProtocolId.Value))
                        isFollowed = true;
                    if (viewModel.AuditorId.HasValue && followedAuditors.Contains(viewModel.AuditorId.Value))
                        isFollowed = true;
                    if (viewModel.CompanyId.HasValue && followedCompanies.Contains(viewModel.CompanyId.Value))
                        isFollowed = true;

                    enrichedActivities.Add((viewModel, isFollowed));
                }
            }

            // Prioritize followed entities, then by date
            return enrichedActivities
                .OrderByDescending(x => x.isFollowed)
                .ThenByDescending(x => x.vm.CreatedAt)
                .Take(limit)
                .Select(x => x.vm)
                .ToList();
        }

        private async Task<ActivityViewModel?> EnrichActivity(Db db, ActivityModel activity)
        {
            var viewModel = new ActivityViewModel
            {
                Id = activity.Id,
                Type = activity.Type,
                TypeLabel = GetActivityTypeLabel(activity.Type),
                EntityId = activity.EntityId,
                LoginId = activity.LoginId,
                CreatedAt = activity.CreatedAt
            };

            // Get actor name
            if (activity.LoginId.HasValue)
            {
                var user = await db.Login.FindAsync(activity.LoginId.Value);
                viewModel.ActorName = user?.FullName ?? user?.Login ?? "Unknown";
            }
            else
            {
                viewModel.ActorName = "System";
            }

            // Enrich based on activity type
            switch (activity.Type)
            {
                case ActivityType.ReportCreated:
                case ActivityType.ReportApproved:
                    var report = await db.Report
                        .Include(r => r.Protocol)
                        .Include(r => r.Auditor)
                        .FirstOrDefaultAsync(r => r.Id == activity.EntityId);
                    
                    if (report == null) return null;
                    
                    viewModel.EntityTitle = report.Name;
                    viewModel.EntityUrl = $"/reports/{report.Id}";
                    viewModel.ProtocolId = report.ProtocolId;
                    viewModel.ProtocolName = report.Protocol?.Name;
                    viewModel.AuditorId = report.AuditorId;
                    viewModel.AuditorName = report.Auditor?.Name;
                    
                    // Get company through protocol
                    if (report.Protocol != null)
                    {
                        var company = await db.Company.FindAsync(report.Protocol.CompanyId);
                        viewModel.CompanyId = company?.Id;
                        viewModel.CompanyName = company?.Name;
                    }
                    break;

                case ActivityType.VulnerabilityCreated:
                case ActivityType.VulnerabilityApproved:
                    var vuln = await db.Vulnerability
                        .Include(v => v.Report)
                            .ThenInclude(r => r!.Protocol)
                        .Include(v => v.Report)
                            .ThenInclude(r => r!.Auditor)
                        .FirstOrDefaultAsync(v => v.Id == activity.EntityId);
                    
                    if (vuln == null) return null;
                    
                    viewModel.EntityTitle = vuln.Title;
                    viewModel.EntityUrl = $"/vulnerabilities/{vuln.Id}";
                    viewModel.Severity = vuln.Severity;
                    
                    if (vuln.Report != null)
                    {
                        viewModel.ProtocolId = vuln.Report.ProtocolId;
                        viewModel.ProtocolName = vuln.Report.Protocol?.Name;
                        viewModel.AuditorId = vuln.Report.AuditorId;
                        viewModel.AuditorName = vuln.Report.Auditor?.Name;
                        
                        if (vuln.Report.Protocol != null)
                        {
                            var company = await db.Company.FindAsync(vuln.Report.Protocol.CompanyId);
                            viewModel.CompanyId = company?.Id;
                            viewModel.CompanyName = company?.Name;
                        }
                    }
                    break;

                case ActivityType.CommentCreated:
                    var comment = await db.Comment.FindAsync(activity.EntityId);
                    if (comment == null) return null;
                    
                    // Get entity details based on comment entity type
                    viewModel.EntityTitle = await GetCommentEntityTitle(db, comment);
                    viewModel.EntityUrl = await GetCommentEntityUrl(db, comment);
                    break;

                default:
                    return null;
            }

            return viewModel;
        }

        private async Task<string> GetCommentEntityTitle(Db db, CommentModel comment)
        {
            switch (comment.EntityType)
            {
                case CommentEntityType.Report:
                    var report = await db.Report.FindAsync(comment.EntityId);
                    return report?.Name ?? "Unknown Report";
                
                case CommentEntityType.Vulnerability:
                    var vuln = await db.Vulnerability.FindAsync(comment.EntityId);
                    return vuln?.Title ?? "Unknown Vulnerability";
                
                case CommentEntityType.Protocol:
                    var protocol = await db.Protocol.FindAsync(comment.EntityId);
                    return protocol?.Name ?? "Unknown Protocol";
                
                case CommentEntityType.Auditor:
                    var auditor = await db.Auditor.FindAsync(comment.EntityId);
                    return auditor?.Name ?? "Unknown Auditor";
                
                case CommentEntityType.Company:
                    var company = await db.Company.FindAsync(comment.EntityId);
                    return company?.Name ?? "Unknown Company";
                
                default:
                    return "Unknown";
            }
        }

        private async Task<string> GetCommentEntityUrl(Db db, CommentModel comment)
        {
            switch (comment.EntityType)
            {
                case CommentEntityType.Report:
                    return $"/reports/{comment.EntityId}";
                
                case CommentEntityType.Vulnerability:
                    return $"/vulnerabilities/{comment.EntityId}";
                
                case CommentEntityType.Protocol:
                    return $"/protocols/{comment.EntityId}";
                
                case CommentEntityType.Auditor:
                    return $"/auditors/{comment.EntityId}";
                
                case CommentEntityType.Company:
                    return $"/companies/{comment.EntityId}";
                
                default:
                    return "#";
            }
        }

        private string GetActivityTypeLabel(ActivityType type)
        {
            return type switch
            {
                ActivityType.ReportCreated => "New Report",
                ActivityType.ReportApproved => "Report Approved",
                ActivityType.VulnerabilityCreated => "New Vulnerability",
                ActivityType.VulnerabilityApproved => "Vulnerability Approved",
                ActivityType.CommentCreated => "New Comment",
                _ => "Unknown Activity"
            };
        }
    }

    public interface IActivityProcessor
    {
        Task<int> Add(ActivityModel activity);
        Task<List<ActivityViewModel>> GetRecentActivities(int hours, int limit, int? loginId = null);
        Task<List<ActivityViewModel>> GetPersonalizedActivities(int loginId, int hours, int limit);
    }
}

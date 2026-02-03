namespace SorobanSecurityPortalApi.Services.ControllersServices
{
    /// <summary>
    /// Service for managing user reputation based on contributions
    /// </summary>
    public interface IReputationService
    {
        Task AwardCommentUpvoteAsync(int userId);
        Task DeductCommentDownvoteAsync(int userId);
        Task AwardReportApprovalAsync(int userId);
        Task AwardVulnerabilityAddedAsync(int userId, string severity);
        Task AwardRatingPostedAsync(int userId);
        Task RecalculateUserReputationAsync(int userId);
        Task RecalculateAllUsersReputationAsync();
    }
}


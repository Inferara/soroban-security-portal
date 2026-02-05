using Microsoft.EntityFrameworkCore;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;

namespace SorobanSecurityPortalApi.Services.ControllersServices
{
    public interface ICommentService
    {
        Task<Result<CommentViewModel, string>> Add(int userId, CreateCommentRequest request);
        Task<Result<CommentViewModel, string>> Update(int userId, int commentId, UpdateCommentRequest request);
        Task<Result<bool, string>> Delete(int userId, int commentId, bool isAdmin);
        Task<List<CommentViewModel>> List(int referenceId, ReferenceType referenceType, int? currentUserId);
        Task<Result<List<CommentHistoryItem>, string>> GetHistory(int userId, int commentId, bool isAdmin);
    }

    public class CommentService : ICommentService
    {
        private readonly Db _db;

        public CommentService(Db db)
        {
            _db = db;
        }

        public async Task<Result<CommentViewModel, string>> Add(int userId, CreateCommentRequest request)
        {
            // Basic validation
            if (string.IsNullOrWhiteSpace(request.Content))
                return Result<CommentViewModel, string>.Error("Content cannot be empty");

            // TODO: Run content filter here if needed

            var comment = new CommentModel
            {
                UserId = userId,
                ReferenceId = request.ReferenceId,
                ReferenceType = request.ReferenceType,
                Content = request.Content,
                Created = DateTime.UtcNow,
                History = new List<CommentHistoryItem>()
            };

            _db.Comments.Add(comment);
            await _db.SaveChangesAsync();

            return Result<CommentViewModel, string>.Success(MapToViewModel(comment, userId));
        }

        public async Task<Result<CommentViewModel, string>> Update(int userId, int commentId, UpdateCommentRequest request)
        {
            var comment = await _db.Comments
                .Include(c => c.User)
                .FirstOrDefaultAsync(c => c.Id == commentId);

            if (comment == null)
                return Result<CommentViewModel, string>.Error("Comment not found");

            if (comment.UserId != userId)
                return Result<CommentViewModel, string>.Error("Unauthorized");

            // Check 30-minute window
            if (DateTime.UtcNow > comment.Created.AddMinutes(30))
                return Result<CommentViewModel, string>.Error("Edit window expired (30 minutes)");

            if (string.IsNullOrWhiteSpace(request.Content))
                return Result<CommentViewModel, string>.Error("Content cannot be empty");

            // Save history
            if (comment.History == null) comment.History = new List<CommentHistoryItem>();
            
            comment.History.Add(new CommentHistoryItem
            {
                Content = comment.Content,
                EditedAt = DateTime.UtcNow
            });

            comment.Content = request.Content;
            comment.LastEdited = DateTime.UtcNow;

            await _db.SaveChangesAsync();

            return Result<CommentViewModel, string>.Success(MapToViewModel(comment, userId));
        }

        public async Task<Result<bool, string>> Delete(int userId, int commentId, bool isAdmin)
        {
            var comment = await _db.Comments.FindAsync(commentId);
            if (comment == null)
                return Result<bool, string>.Error("Comment not found");

            if (comment.UserId != userId && !isAdmin)
                return Result<bool, string>.Error("Unauthorized");

            comment.IsDeleted = true;
            await _db.SaveChangesAsync();

            return Result<bool, string>.Success(true);
        }

        public async Task<List<CommentViewModel>> List(int referenceId, ReferenceType referenceType, int? currentUserId)
        {
            var comments = await _db.Comments
                .Include(c => c.User)
                .Where(c => c.ReferenceId == referenceId && c.ReferenceType == referenceType && !c.IsDeleted)
                .OrderByDescending(c => c.Created)
                .ToListAsync();

            return comments.Select(c => MapToViewModel(c, currentUserId)).ToList();
        }

        public async Task<Result<List<CommentHistoryItem>, string>> GetHistory(int userId, int commentId, bool isAdmin)
        {
            if (!isAdmin)
                return Result<List<CommentHistoryItem>, string>.Error("Unauthorized"); // Only moderators/admins can view history per requirements

            var comment = await _db.Comments.FindAsync(commentId);
            if (comment == null)
                return Result<List<CommentHistoryItem>, string>.Error("Comment not found");

            return Result<List<CommentHistoryItem>, string>.Success(comment.History ?? new List<CommentHistoryItem>());
        }

        private CommentViewModel MapToViewModel(CommentModel comment, int? currentUserId)
        {
            var canEdit = false;
            if (currentUserId.HasValue && comment.UserId == currentUserId.Value)
            {
                canEdit = DateTime.UtcNow <= comment.Created.AddMinutes(30);
            }

            return new CommentViewModel
            {
                Id = comment.Id,
                UserId = comment.UserId,
                UserName = comment.User?.FullName ?? "Unknown", 
                UserAvatarUrl = comment.User?.Picture, 
                ReferenceId = comment.ReferenceId,
                ReferenceType = comment.ReferenceType,
                Content = comment.Content,
                Created = comment.Created,
                LastEdited = comment.LastEdited,
                IsDeleted = comment.IsDeleted,
                IsEditable = canEdit,
                IsOwner = currentUserId.HasValue && comment.UserId == currentUserId.Value,
                History = comment.History
            };
        }
    }
}

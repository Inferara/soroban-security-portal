using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;

namespace SorobanSecurityPortalApi.Services.ControllersServices
{
    public interface IRatingService
    {
        Task<RatingSummaryViewModel> GetSummary(EntityType entityType, int entityId);
        Task<List<RatingViewModel>> GetRatings(EntityType entityType, int entityId, int page, int pageSize = 10);
        Task<RatingViewModel> AddOrUpdateRating(CreateRatingRequest request);
        Task DeleteRating(int id);
    }

    public class RatingService : IRatingService
    {
        private readonly Db _db;
        private readonly CacheAccessor _cache;
        private readonly UserContextAccessor _userContext;

        public RatingService(Db db, CacheAccessor cache, UserContextAccessor userContext)
        {
            _db = db;
            _cache = cache;
            _userContext = userContext;
        }

        public async Task<RatingSummaryViewModel> GetSummary(EntityType entityType, int entityId)
        {
            string cacheKey = $"ratings_summary_{entityType}_{entityId}";
            
            var cached = await _cache.GetAsync<RatingSummaryViewModel>(cacheKey);
            if (cached != null) return cached;

            var ratings = await _db.Rating
                .Where(r => r.EntityType == entityType && r.EntityId == entityId)
                .ToListAsync();

            var summary = new RatingSummaryViewModel
            {
                EntityType = entityType,
                EntityId = entityId,
                TotalReviews = ratings.Count,
                AverageScore = ratings.Any() ? Math.Round(ratings.Average(r => r.Score), 1) : 0,
                Distribution = new Dictionary<int, int>
                {
                    { 1, ratings.Count(r => r.Score == 1) },
                    { 2, ratings.Count(r => r.Score == 2) },
                    { 3, ratings.Count(r => r.Score == 3) },
                    { 4, ratings.Count(r => r.Score == 4) },
                    { 5, ratings.Count(r => r.Score == 5) }
                }
            };

            await _cache.SetAsync(cacheKey, summary, TimeSpan.FromMinutes(10));

            return summary;
        }

        public async Task<List<RatingViewModel>> GetRatings(EntityType entityType, int entityId, int page, int pageSize = 10)
        {
            var query = _db.Rating
                .AsNoTracking()
                .Where(r => r.EntityType == entityType && r.EntityId == entityId)
                .OrderByDescending(r => r.CreatedAt);

            var ratings = await query
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(r => new RatingViewModel
                {
                    Id = r.Id,
                    UserId = r.UserId,
                    EntityType = r.EntityType,
                    EntityId = r.EntityId,
                    Score = r.Score,
                    Review = r.Review,
                    CreatedAt = r.CreatedAt
                })
                .ToListAsync();

            return ratings;
        }

        public async Task<RatingViewModel> AddOrUpdateRating(CreateRatingRequest request)
        {
            var userId = await _userContext.GetLoginIdAsync();
            if (userId == 0) throw new UnauthorizedAccessException("User not logged in.");

            var existing = await _db.Rating
                .FirstOrDefaultAsync(r => r.UserId == userId && r.EntityType == request.EntityType && r.EntityId == request.EntityId);

            if (existing != null)
            {
                existing.Score = request.Score;
                existing.Review = request.Review;
                existing.UpdatedAt = DateTime.UtcNow;
            }
            else
            {
                existing = new RatingModel
                {
                    UserId = userId,
                    EntityType = request.EntityType,
                    EntityId = request.EntityId,
                    Score = request.Score,
                    Review = request.Review,
                    CreatedAt = DateTime.UtcNow
                };
                _db.Rating.Add(existing);
            }

            await _db.SaveChangesAsync();
            await InvalidateSummaryCache(request.EntityType, request.EntityId);

            return new RatingViewModel
            {
                Id = existing.Id,
                UserId = existing.UserId,
                EntityType = existing.EntityType,
                EntityId = existing.EntityId,
                Score = existing.Score,
                Review = existing.Review,
                CreatedAt = existing.CreatedAt
            };
        }

        public async Task DeleteRating(int id)
        {
            var userId = await _userContext.GetLoginIdAsync();
            var rating = await _db.Rating.FindAsync(id);

            if (rating == null) return;
            
            // Allow deletion if user owns it. 
            // Admin check: if (!IsAdmin && rating.UserId != userId)
            if (rating.UserId != userId && !await _userContext.IsLoginIdAdmin(userId)) 
                throw new UnauthorizedAccessException("You can only delete your own ratings.");

            _db.Rating.Remove(rating);
            await _db.SaveChangesAsync();

            await InvalidateSummaryCache(rating.EntityType, rating.EntityId);
        }

        private async Task InvalidateSummaryCache(EntityType type, int id)
        {
            string cacheKey = $"ratings_summary_{type}_{id}";
            await _cache.RemoveAsync(cacheKey);
        }
    }
}
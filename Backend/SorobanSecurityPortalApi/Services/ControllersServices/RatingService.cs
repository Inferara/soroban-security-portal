using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using System.Text.Json;
using AutoMapper;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;

namespace SorobanSecurityPortalApi.Services.ControllersServices
{
    public interface IRatingService
    {
        Task<RatingSummaryViewModel> GetSummary(EntityType entityType, int entityId);
        Task<RatingSummaryWeightedViewModel> GetSummaryWeighted(EntityType entityType, int entityId);
        Task<List<RatingViewModel>> GetRatings(EntityType entityType, int entityId, int page, int pageSize = 10);
        Task<List<RatingWithAuthorViewModel>> GetRatingsWithAuthor(EntityType entityType, int entityId, int page, int pageSize = 10, bool withReviewsOnly = false);
        Task<RatingViewModel?> GetMyRating(EntityType entityType, int entityId);
        Task<RatingViewModel> AddOrUpdateRating(CreateRatingRequest request);
        Task DeleteRating(int id);
    }

    public class RatingService : IRatingService
    {
        private readonly Db _db;
        private readonly IDistributedCache _cache;
        private readonly UserContextAccessor _userContext;
        private readonly IMapper _mapper;

        public RatingService(Db db, IDistributedCache cache, UserContextAccessor userContext, IMapper mapper)
        {
            _db = db;
            _cache = cache;
            _userContext = userContext;
            _mapper = mapper;
        }

        public async Task<RatingSummaryViewModel> GetSummary(EntityType entityType, int entityId)
        {
            string cacheKey = $"ratings_summary_{entityType}_{entityId}";

            // Try get from Cache (Using helper method)
            var cached = await GetCachedAsync<RatingSummaryViewModel>(cacheKey);
            if (cached != null) return cached;

            var aggregated = await _db.Rating
                .Where(r => r.EntityType == entityType && r.EntityId == entityId)
                .GroupBy(r => 1)
                .Select(g => new
                {
                    TotalReviews = g.Count(),
                    AverageScore = g.Average(r => (double?)r.Score),
                    Count1 = g.Count(r => r.Score == 1),
                    Count2 = g.Count(r => r.Score == 2),
                    Count3 = g.Count(r => r.Score == 3),
                    Count4 = g.Count(r => r.Score == 4),
                    Count5 = g.Count(r => r.Score == 5)
                })
                .FirstOrDefaultAsync();

            var summary = new RatingSummaryViewModel
            {
                EntityType = entityType,
                EntityId = entityId,
                TotalReviews = aggregated?.TotalReviews ?? 0,
                AverageScore = aggregated?.AverageScore != null ? (float)Math.Round(aggregated.AverageScore.Value, 1) : 0f,
                Distribution = new Dictionary<int, int>
                {
                    { 1, aggregated?.Count1 ?? 0 },
                    { 2, aggregated?.Count2 ?? 0 },
                    { 3, aggregated?.Count3 ?? 0 },
                    { 4, aggregated?.Count4 ?? 0 },
                    { 5, aggregated?.Count5 ?? 0 }
                }
            };

            // Cache for 10 minutes (Using helper method)
            await SetCachedAsync(cacheKey, summary, TimeSpan.FromMinutes(10));

            return summary;
        }

        public async Task<RatingSummaryWeightedViewModel> GetSummaryWeighted(EntityType entityType, int entityId)
        {
            string cacheKey = $"ratings_summary_weighted_{entityType}_{entityId}";

            var cached = await GetCachedAsync<RatingSummaryWeightedViewModel>(cacheKey);
            if (cached != null) return cached;

            var baseSummary = await GetSummary(entityType, entityId);

            var ratingRows = await (
                from r in _db.Rating.AsNoTracking()
                join up in _db.UserProfiles.AsNoTracking() on r.UserId equals up.LoginId into upj
                from up in upj.DefaultIfEmpty()
                where r.EntityType == entityType && r.EntityId == entityId
                select new
                {
                    r.Score,
                    Reputation = (int?)up.ReputationScore
                }
            ).ToListAsync();

            double weightedSum = 0;
            double weightTotal = 0;

            foreach (var row in ratingRows)
            {
                var reputation = row.Reputation ?? 0;
                // Weight function: 1..10 based on reputation buckets of 100
                var weight = 1 + Math.Min(9, Math.Max(0, reputation / 100));
                weightedSum += row.Score * weight;
                weightTotal += weight;
            }

            var weightedAverage = weightTotal > 0 ? (float)Math.Round(weightedSum / weightTotal, 1) : 0f;

            var summary = new RatingSummaryWeightedViewModel
            {
                EntityType = baseSummary.EntityType,
                EntityId = baseSummary.EntityId,
                AverageScore = baseSummary.AverageScore,
                TotalReviews = baseSummary.TotalReviews,
                Distribution = baseSummary.Distribution,
                WeightedAverageScore = weightedAverage,
                WeightedTotalReviews = baseSummary.TotalReviews
            };

            await SetCachedAsync(cacheKey, summary, TimeSpan.FromMinutes(10));
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
                .ToListAsync();

            return _mapper.Map<List<RatingViewModel>>(ratings);
        }

        public async Task<List<RatingWithAuthorViewModel>> GetRatingsWithAuthor(EntityType entityType, int entityId, int page, int pageSize = 10, bool withReviewsOnly = false)
        {
            var query =
                from r in _db.Rating.AsNoTracking()
                join l in _db.Login.AsNoTracking() on r.UserId equals l.LoginId
                join up in _db.UserProfiles.AsNoTracking() on l.LoginId equals up.LoginId into upj
                from up in upj.DefaultIfEmpty()
                where r.EntityType == entityType
                      && r.EntityId == entityId
                      && (!withReviewsOnly || (r.Review != null && r.Review != ""))
                orderby r.CreatedAt descending
                select new RatingWithAuthorViewModel
                {
                    Id = r.Id,
                    UserId = r.UserId,
                    EntityType = r.EntityType,
                    EntityId = r.EntityId,
                    Score = r.Score,
                    Review = r.Review ?? string.Empty,
                    CreatedAt = r.CreatedAt,
                    Author = new RatingAuthorViewModel
                    {
                        LoginId = l.LoginId,
                        FullName = l.FullName,
                        ReputationScore = up != null ? up.ReputationScore : 0
                    }
                };

            return await query
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();
        }

        public async Task<RatingViewModel?> GetMyRating(EntityType entityType, int entityId)
        {
            var userId = await _userContext.GetLoginIdAsync();
            if (userId == 0) throw new UnauthorizedAccessException("User not logged in.");

            var rating = await _db.Rating
                .AsNoTracking()
                .FirstOrDefaultAsync(r => r.UserId == userId && r.EntityType == entityType && r.EntityId == entityId);

            return rating == null ? null : _mapper.Map<RatingViewModel>(rating);
        }

        public async Task<RatingViewModel> AddOrUpdateRating(CreateRatingRequest request)
        {
            var userId = await _userContext.GetLoginIdAsync();
            if (userId == 0) throw new UnauthorizedAccessException("User not logged in.");

            var existing = await _db.Rating
                .FirstOrDefaultAsync(r => r.UserId == userId && r.EntityType == request.EntityType && r.EntityId == request.EntityId);

            if (existing != null)
            {
                _mapper.Map(request, existing);
                existing.UpdatedAt = DateTime.UtcNow;
            }
            else
            {
                existing = _mapper.Map<RatingModel>(request);
                existing.UserId = userId;

                _db.Rating.Add(existing);
            }

            await _db.SaveChangesAsync();
            await InvalidateSummaryCache(request.EntityType, request.EntityId);

            return _mapper.Map<RatingViewModel>(existing);
        }

        public async Task DeleteRating(int id)
        {
            var userId = await _userContext.GetLoginIdAsync();
            var rating = await _db.Rating.FindAsync(id);

            if (rating == null)
                throw new KeyNotFoundException($"Rating with id {id} not found.");

            // Allow deletion if user owns it OR user is Admin
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

            string weightedCacheKey = $"ratings_summary_weighted_{type}_{id}";
            await _cache.RemoveAsync(weightedCacheKey);
        }

        // --- HELPER METHODS FOR CACHING ---

        private async Task<T?> GetCachedAsync<T>(string key)
        {
            var data = await _cache.GetStringAsync(key);
            if (string.IsNullOrEmpty(data)) return default;
            return JsonSerializer.Deserialize<T>(data);
        }

        private async Task SetCachedAsync<T>(string key, T value, TimeSpan expiry)
        {
            var options = new DistributedCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = expiry
            };
            var data = JsonSerializer.Serialize(value);
            await _cache.SetStringAsync(key, data, options);
        }
    }
}
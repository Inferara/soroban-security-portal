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
        Task<List<PublicRatingViewModel>> GetRatings(EntityType entityType, int entityId, int page, int pageSize = 10);
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
        private readonly IContentFilterService _contentFilter;

        public RatingService(Db db, IDistributedCache cache, UserContextAccessor userContext, IMapper mapper, IContentFilterService contentFilter)
        {
            _db = db;
            _cache = cache;
            _userContext = userContext;
            _mapper = mapper;
            _contentFilter = contentFilter;
        }

        public async Task<RatingSummaryViewModel> GetSummary(EntityType entityType, int entityId)
        {
            string cacheKey = $"ratings_summary_{entityType}_{entityId}";
            
            // Try get from Cache (Using helper method)
            var cached = await GetCachedAsync<RatingSummaryViewModel>(cacheKey);
            if (cached != null) return cached;

            var aggregated = await _db.Rating
                .Where(r => r.EntityType == entityType && r.EntityId == entityId && !r.IsHidden && !r.IsDeleted)
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

            summary.WeightedAverageScore = await ComputeWeightedAverage(entityType, entityId, summary.AverageScore);

            // Cache for 10 minutes (Using helper method)
            await SetCachedAsync(cacheKey, summary, TimeSpan.FromMinutes(10));

            return summary;
        }

        public async Task<List<PublicRatingViewModel>> GetRatings(EntityType entityType, int entityId, int page, int pageSize = 10)
        {
            page = Math.Max(1, page);
            pageSize = Math.Max(1, Math.Min(100, pageSize));

            var ratings = await _db.Rating
                .AsNoTracking()
                .Where(r => r.EntityType == entityType && r.EntityId == entityId && !r.IsHidden && !r.IsDeleted)
                .OrderByDescending(r => r.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            var result = _mapper.Map<List<PublicRatingViewModel>>(ratings);

            // Populate author display name + id with a single extra single-set query.
            // Only the public display name is exposed — never email or other PII.
            var userIds = ratings.Select(r => r.UserId).Distinct().ToList();
            if (userIds.Count > 0)
            {
                var names = await _db.Login
                    .AsNoTracking()
                    .Where(l => userIds.Contains(l.LoginId))
                    .Select(l => new { l.LoginId, l.FullName, l.Login })
                    .ToListAsync();
                var nameById = names.ToDictionary(
                    n => n.LoginId,
                    n => !string.IsNullOrWhiteSpace(n.FullName) ? n.FullName : n.Login);

                for (int i = 0; i < result.Count; i++)
                {
                    var uid = ratings[i].UserId;
                    result[i].AuthorId = uid;
                    result[i].AuthorName = nameById.TryGetValue(uid, out var nm) && !string.IsNullOrWhiteSpace(nm)
                        ? nm
                        : "Anonymous";
                }
            }

            return result;
        }

        public async Task<RatingViewModel?> GetMyRating(EntityType entityType, int entityId)
        {
            var userId = await _userContext.GetLoginIdAsync();
            if (userId == 0) return null;

            var rating = await _db.Rating
                .AsNoTracking()
                .FirstOrDefaultAsync(r => r.UserId == userId && r.EntityType == entityType && r.EntityId == entityId);

            return rating == null ? null : _mapper.Map<RatingViewModel>(rating);
        }

        public async Task<RatingViewModel> AddOrUpdateRating(CreateRatingRequest request)
        {
            var userId = await _userContext.GetLoginIdAsync();
            if (userId == 0) throw new UnauthorizedAccessException("User not logged in.");

            // Reject ratings for entities that don't exist, to avoid orphan rows.
            var entityExists = request.EntityType == EntityType.Protocol
                ? await _db.Protocol.AnyAsync(p => p.Id == request.EntityId)
                : await _db.Auditor.AnyAsync(a => a.Id == request.EntityId);
            if (!entityExists)
                throw new KeyNotFoundException($"{request.EntityType} with id {request.EntityId} not found.");

            // Run the shared content guard over the (optional) review text: rate-limit
            // writes and block spam/profanity. Empty reviews skip the filter (score-only).
            if (!await _contentFilter.CheckRateLimitAsync(userId))
                throw new InvalidOperationException("Rate limit exceeded. Please wait a moment before submitting again.");

            if (!string.IsNullOrWhiteSpace(request.Review))
            {
                var filterResult = await _contentFilter.FilterContentAsync(request.Review, userId);
                if (filterResult.IsBlocked)
                    throw new InvalidOperationException($"Review blocked: {string.Join("; ", filterResult.Warnings)}");
            }

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

        // Reputation-weighted average: each score is weighted by (1 + reviewer ReputationScore).
        // Reviewers without a profile default to reputation 0 (weight 1). Falls back to the plain
        // average when there are no ratings or no weight could be accumulated.
        private async Task<float> ComputeWeightedAverage(EntityType entityType, int entityId, float plainAverage)
        {
            var scored = await _db.Rating
                .AsNoTracking()
                .Where(r => r.EntityType == entityType && r.EntityId == entityId && !r.IsHidden && !r.IsDeleted)
                .Select(r => new { r.UserId, r.Score })
                .ToListAsync();

            if (scored.Count == 0) return 0f;

            var ids = scored.Select(s => s.UserId).Distinct().ToList();
            var reputationByUser = await _db.UserProfiles
                .AsNoTracking()
                .Where(up => ids.Contains(up.LoginId))
                .ToDictionaryAsync(up => up.LoginId, up => up.ReputationScore);

            double weightedSum = 0, weightTotal = 0;
            foreach (var s in scored)
            {
                var weight = 1.0 + (reputationByUser.TryGetValue(s.UserId, out var rep) ? rep : 0);
                weightedSum += s.Score * weight;
                weightTotal += weight;
            }

            return weightTotal > 0 ? (float)Math.Round(weightedSum / weightTotal, 1) : plainAverage;
        }

        private async Task InvalidateSummaryCache(EntityType type, int id)
        {
            string cacheKey = $"ratings_summary_{type}_{id}";
            await _cache.RemoveAsync(cacheKey);
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
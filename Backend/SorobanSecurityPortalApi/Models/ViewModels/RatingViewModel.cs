using System;
using System.Collections.Generic;
using SorobanSecurityPortalApi.Models.DbModels;

namespace SorobanSecurityPortalApi.Models.ViewModels
{
    public class RatingViewModel
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public EntityType EntityType { get; set; }
        public int EntityId { get; set; }
        public int Score { get; set; }
        public string Review { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
    }

    public class RatingAuthorViewModel
    {
        public int LoginId { get; set; }
        public string FullName { get; set; } = string.Empty;
        public int ReputationScore { get; set; }
    }

    public class RatingWithAuthorViewModel
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public EntityType EntityType { get; set; }
        public int EntityId { get; set; }
        public int Score { get; set; }
        public string Review { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public RatingAuthorViewModel Author { get; set; } = new RatingAuthorViewModel();
    }

    public class CreateRatingRequest
    {
        public EntityType EntityType { get; set; }
        public int EntityId { get; set; }
        public int Score { get; set; }
        public string Review { get; set; } = string.Empty;
    }

    public class RatingSummaryViewModel
    {
        public EntityType EntityType { get; set; }
        public int EntityId { get; set; }
        public float AverageScore { get; set; }

        public int TotalReviews { get; set; }

        // Distribution: Key is star (1-5), Value is count
        public Dictionary<int, int> Distribution { get; set; } = new Dictionary<int, int>();
    }

    public class RatingSummaryWeightedViewModel : RatingSummaryViewModel
    {
        public float WeightedAverageScore { get; set; }
        public int WeightedTotalReviews { get; set; }
    }
}
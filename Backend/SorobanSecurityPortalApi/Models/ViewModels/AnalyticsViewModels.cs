using System;
using System.Collections.Generic;
using SorobanSecurityPortalApi.Models.DbModels;

namespace SorobanSecurityPortalApi.Models.ViewModels
{
    // Public per-entity counter payload. Total = all-time human views; Today = human views since
    // 00:00 UTC; Unique = distinct visitors all-time (kept for the tooltip).
    public class PageViewCountViewModel
    {
        public int Total { get; set; }
        public int Today { get; set; }
        public int Unique { get; set; }
    }

    public class TopEntityViewModel
    {
        public EntityType EntityType { get; set; }
        public int EntityId { get; set; }
        public string Title { get; set; } = string.Empty;
        public int Views { get; set; }
    }

    public class DailyViewsViewModel
    {
        public DateTime Date { get; set; }
        public int Views { get; set; }
    }

    // Admin dashboard payload.
    public class AnalyticsStatisticsViewModel
    {
        public int TotalHumanViews { get; set; }
        public int UniqueVisitors { get; set; }
        public int CrawlerShares { get; set; }
        public List<TopEntityViewModel> TopEntities { get; set; } = new();
        public List<DailyViewsViewModel> Daily { get; set; } = new();
    }
}

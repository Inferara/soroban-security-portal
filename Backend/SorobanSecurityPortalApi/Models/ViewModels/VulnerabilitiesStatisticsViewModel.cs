namespace SorobanSecurityPortalApi.Models.ViewModels
{
    public class VulnerabilitiesStatisticsViewModel
    {
        public int Total { get; set; }
        public Dictionary<string, int> BySeverity { get; set; } = new Dictionary<string, int>
        {
            { "critical", 0 },
            { "high", 0 },
            { "medium", 0 },
            { "low", 0 },
            { "note", 0 }
        };
        public Dictionary<string, int> ByTag { get; set; } = new Dictionary<string, int>();
    }

    public class VulnerabilityStatisticsChangesViewModel
    {
        public int Total { get; set; }
        public int New { get; set; }
    }
}

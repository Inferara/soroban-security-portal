namespace SorobanSecurityPortalApi.Models.ViewModels
{
    public class VulnerabilitiesStatisticsViewModel
    {
        public int Total { get; set; }
        public int Critical { get; set; }
        public int High { get; set; }
        public int Medium { get; set; }
        public int Low { get; set; }
        public int Note { get; set; }
    }
}

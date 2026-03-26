using System.Collections.Generic;

namespace SorobanSecurityPortalApi.Models.ViewModels
{
    public class ProtocolWithMetricsViewModel
    {
        public ProtocolViewModel Protocol { get; set; } = null!;
        public int ReportsCount { get; set; }
        public int VulnerabilitiesCount { get; set; }
        public int FixedCount { get; set; }
        public int FixRate { get; set; }
        public string CompanyName { get; set; } = "N/A";
        public List<string> Auditors { get; set; } = new List<string>();
    }
}

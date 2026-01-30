using System.ComponentModel.DataAnnotations;

namespace SorobanSecurityPortalApi.Models.ViewModels
{
    public class AuditorRatingViewModel
    {
        public int Id { get; set; }
        public int AuditorId { get; set; }
        
        [Range(1, 5)]
        public int QualityScore { get; set; }
        
        [Range(1, 5)]
        public int CommunicationScore { get; set; }
        
        [Range(1, 5)]
        public int ThoroughnessScore { get; set; }
        
        public string? Comment { get; set; }
        
        public int CreatedBy { get; set; }
        public string? CreatedByName { get; set; }
        public DateTime CreatedAt { get; set; }
        
        // Calculated field for ease of use in UI
        public double AverageScore => (QualityScore + CommunicationScore + ThoroughnessScore) / 3.0;
    }
}

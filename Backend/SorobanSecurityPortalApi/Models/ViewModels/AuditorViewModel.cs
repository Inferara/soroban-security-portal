using System.Text.Json.Serialization;

namespace SorobanSecurityPortalApi.Models.ViewModels
{
    public class AuditorViewModel
    {
        public int Id { get; set; }
        public string Name { get; set; } = "";
        public string Description { get; set; } = "";
        [JsonPropertyName("image")]
        public byte[]? ImageData { get; set; }
        public string Url { get; set; } = "";
        public DateTime Date { get; set; }
        public int CreatedBy { get; set; }
        public double AverageRating { get; set; }
        public int RatingCount { get; set; }
        public List<AuditorRatingViewModel> Ratings { get; set; } = new();
    }
}

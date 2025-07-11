namespace SorobanSecurityPortalApi.Models.ViewModels
{
    public class ProxyRequestModel
    {
        public string Url { get; set; } = "";
        public string Method { get; set; } = "GET";
        public string Body { get; set; } = "";
        public string ContentType { get; set; } = "application/json";
        public Dictionary<string, string> Headers { get; set; } = new Dictionary<string, string>();
    }
}

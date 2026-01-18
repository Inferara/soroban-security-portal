namespace SorobanSecurityPortalApi.Models.ViewModels
{
    public class LoginProcessViewModel
    {
        public string ClientId { get; set; } = string.Empty;
        public string RedirectUri { get; set; } = string.Empty;
        public string CodeChallenge { get; set; } = string.Empty;
        public string CodeChallengeMethod { get; set; } = string.Empty;
        public List<string> AcrValues { get; set; } = new();
        public string Scope { get; set; } = string.Empty;
        public string ResponseType { get; set; } = string.Empty;
        public string State { get; set; } = string.Empty;
        public bool IsPermanentToken { get; set; } = false;
        public string InternalCodeChallenge { get; set; } = string.Empty;
        public string InternalCodeChallengeMethod { get; set; } = string.Empty;
        public string InternalCodeVerifier { get; set; } = string.Empty;
    }
}
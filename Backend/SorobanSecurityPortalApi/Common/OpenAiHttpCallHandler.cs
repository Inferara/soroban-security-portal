using System.Net;

namespace SorobanSecurityPortalApi.Common
{
    public class OpenAiHttpCallHandler : DelegatingHandler
    {

        public OpenAiHttpCallHandler(
            ExtendedConfig config) : base(
            string.IsNullOrEmpty(config.Proxy)
                ? new HttpClientHandler()
                : new HttpClientHandler
                {
                    ServerCertificateCustomValidationCallback = (_, _, _, _) => true,
                    Proxy = new WebProxy(config.Proxy)
                })
        {
        }
    }
}

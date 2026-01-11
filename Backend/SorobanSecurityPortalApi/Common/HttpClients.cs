using System.Net;
using Polly;
using Polly.Extensions.Http;

namespace SorobanSecurityPortalApi.Common
{
    public static class HttpClients
    {
        public const string NoRetryClient = "NoRetryClient";
        public const string RetryClient = "RetryClient";
        public const string AvatarFetchClient = "AvatarFetchClient";

        public static void AddHttpClients(this IServiceCollection services, ExtendedConfig extendedConfig, ILogger<Startup> logger)
        {
            services.AddHttpClient(RetryClient, httpClient =>
                {
                    httpClient.Timeout = TimeSpan.FromMinutes(3); // wait 3 min instead of 100 sec by default
                })
                .SetHandlerLifetime(TimeSpan.FromMinutes(4))
                .AddPolicyHandler(GetRetryPolicy(logger))
                .ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler
                {
                    Proxy = string.IsNullOrEmpty(extendedConfig.Proxy) ? null : new WebProxy(new Uri(extendedConfig.Proxy)),
                    ServerCertificateCustomValidationCallback = HttpClientHandler.DangerousAcceptAnyServerCertificateValidator,
                    AutomaticDecompression = DecompressionMethods.GZip | DecompressionMethods.Deflate | DecompressionMethods.Brotli
                })
                .ConfigurePrimaryHttpMessageHandler<HttpCallHandler>();

            services.AddHttpClient(NoRetryClient, httpClient =>
                {
                    httpClient.Timeout = TimeSpan.FromMinutes(3); // wait 3 min instead of 100 sec by default
                })
                .SetHandlerLifetime(TimeSpan.FromMinutes(4))
                .ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler
                {
                    Proxy = string.IsNullOrEmpty(extendedConfig.Proxy) ? null : new WebProxy(new Uri(extendedConfig.Proxy)),
                    ServerCertificateCustomValidationCallback = HttpClientHandler.DangerousAcceptAnyServerCertificateValidator,
                    AutomaticDecompression = DecompressionMethods.GZip | DecompressionMethods.Deflate | DecompressionMethods.Brotli
                })
                .ConfigurePrimaryHttpMessageHandler<HttpCallHandler>();

            // Avatar fetch client with short timeout for SSO image downloads
            services.AddHttpClient(AvatarFetchClient, httpClient =>
                {
                    httpClient.Timeout = TimeSpan.FromSeconds(10);
                    httpClient.DefaultRequestHeaders.Add("User-Agent", "SorobanSecurityPortal/1.0");
                })
                .SetHandlerLifetime(TimeSpan.FromMinutes(5))
                .ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler
                {
                    Proxy = string.IsNullOrEmpty(extendedConfig.Proxy) ? null : new WebProxy(new Uri(extendedConfig.Proxy)),
                    AutomaticDecompression = DecompressionMethods.GZip | DecompressionMethods.Deflate | DecompressionMethods.Brotli,
                    AllowAutoRedirect = true,
                    MaxAutomaticRedirections = 3
                });
        }

        private static IAsyncPolicy<HttpResponseMessage> GetRetryPolicy(ILogger<Startup> logger) => HttpPolicyExtensions
            .HandleTransientHttpError()
            .OrResult(msg =>
            {
                var nonSuccessRequest =
                    msg.StatusCode != HttpStatusCode.OK &&
                    msg.StatusCode != HttpStatusCode.Accepted &&
                    msg.StatusCode != (HttpStatusCode)424 &&
                    msg.StatusCode != HttpStatusCode.NoContent;
                if (nonSuccessRequest)
                {
                    logger.LogWarning("Startup: {0}, url: {1}, request headers: {2}, code: {3}, body: {4}, response headers: {5}", "GetRetryPolicy",
                        msg.RequestMessage.RequestUri, msg.RequestMessage.Headers, msg.StatusCode, msg.Content.ReadAsStringAsync().Result, msg.Headers);
                }
                return nonSuccessRequest;
            })
            .WaitAndRetryAsync(7, retryAttempt => TimeSpan.FromSeconds(Math.Pow(2, retryAttempt)));
    }
}

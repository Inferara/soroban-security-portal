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
        public const string ReportFetchClient = "ReportFetchClient";
        public const string AgentClient = "AgentClient";

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

            // Report fetch client for downloading PDFs from external URLs (SSRF-protected)
            services.AddHttpClient(ReportFetchClient, httpClient =>
                {
                    httpClient.Timeout = TimeSpan.FromSeconds(30);
                    httpClient.MaxResponseContentBufferSize = 60 * 1024 * 1024; // 60MB max
                    httpClient.DefaultRequestHeaders.Add("User-Agent", "SorobanSecurityPortal/1.0");
                })
                .SetHandlerLifetime(TimeSpan.FromMinutes(5))
                .ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler
                {
                    Proxy = string.IsNullOrEmpty(extendedConfig.Proxy) ? null : new WebProxy(new Uri(extendedConfig.Proxy)),
                    AutomaticDecompression = DecompressionMethods.GZip | DecompressionMethods.Deflate | DecompressionMethods.Brotli,
                    AllowAutoRedirect = false // Prevent redirect-based SSRF
                });

            // Agent client for AI agent calls with extended timeout (5 minutes)
            // Uses a more conservative retry policy that only retries on transient errors and rate limits
            services.AddHttpClient(AgentClient, httpClient =>
                {
                    httpClient.Timeout = TimeSpan.FromMinutes(5); // Extended timeout for AI processing
                })
                .SetHandlerLifetime(TimeSpan.FromMinutes(6))
                .AddPolicyHandler(GetAgentRetryPolicy(logger))
                .ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler
                {
                    Proxy = string.IsNullOrEmpty(extendedConfig.Proxy) ? null : new WebProxy(new Uri(extendedConfig.Proxy)),
                    AutomaticDecompression = DecompressionMethods.GZip | DecompressionMethods.Deflate | DecompressionMethods.Brotli
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
                        msg.RequestMessage?.RequestUri, msg.RequestMessage?.Headers, msg.StatusCode, msg.Content.ReadAsStringAsync().Result, msg.Headers);
                }
                return nonSuccessRequest;
            })
            .WaitAndRetryAsync(7, retryAttempt => TimeSpan.FromSeconds(Math.Pow(2, retryAttempt)));

        /// <summary>
        /// Conservative retry policy for AI agent calls.
        /// Only retries on transient network errors, 429 (rate limit), and 503 (service unavailable).
        /// Does NOT retry on 400, 401, 403, 404, or 500 errors to prevent cascading failures.
        /// </summary>
        private static IAsyncPolicy<HttpResponseMessage> GetAgentRetryPolicy(ILogger<Startup> logger) => HttpPolicyExtensions
            .HandleTransientHttpError()
            .OrResult(msg =>
            {
                // Only retry on rate limiting (429) or service unavailable (503)
                var shouldRetry = msg.StatusCode == HttpStatusCode.TooManyRequests ||
                                  msg.StatusCode == HttpStatusCode.ServiceUnavailable;
                if (shouldRetry)
                {
                    logger.LogWarning(
                        "AgentRetryPolicy: Retrying due to {StatusCode}, url: {Url}",
                        msg.StatusCode,
                        msg.RequestMessage?.RequestUri);
                }
                return shouldRetry;
            })
            .WaitAndRetryAsync(
                retryCount: 3, // Fewer retries for AI calls
                sleepDurationProvider: retryAttempt => TimeSpan.FromSeconds(Math.Pow(2, retryAttempt) * 2), // Longer backoff: 4s, 8s, 16s
                onRetry: (outcome, timespan, retryAttempt, _) =>
                {
                    logger.LogWarning(
                        "AgentRetryPolicy: Retry attempt {RetryAttempt} after {Delay}s due to {StatusCode}",
                        retryAttempt,
                        timespan.TotalSeconds,
                        outcome.Result?.StatusCode);
                });
    }
}

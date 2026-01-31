using SorobanSecurityPortalApi.Common;

namespace SorobanSecurityPortalApi.Services.ProcessingServices
{
    public class DigestHostedService : IHostedService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly Config _config;
        private readonly ILogger<DigestHostedService> _logger;

        public DigestHostedService(IServiceProvider serviceProvider, Config config, ILogger<DigestHostedService> logger)
        {
            _serviceProvider = serviceProvider;
            _config = config;
            _logger = logger;
        }

        public async Task StartAsync(CancellationToken cancellationToken)
        {
            _logger.LogInformation("Digest Hosted Service started.");
            
            _ = ExecuteLoopAsync(cancellationToken);
            
            await Task.CompletedTask;
        }

        private async Task ExecuteLoopAsync(CancellationToken cancellationToken)
        {
            while (!cancellationToken.IsCancellationRequested)
            {
                try
                {
                    var now = DateTime.UtcNow;

                    // Run every Friday at 09:00 UTC
                    if (now.DayOfWeek == DayOfWeek.Friday && now.Hour == 9)
                    {
                        _logger.LogInformation("Starting Weekly Digest Job...");
                        
                        using (var scope = _serviceProvider.CreateScope())
                        {
                            var digestService = scope.ServiceProvider.GetRequiredService<IDigestService>();
                            await digestService.ProcessDigestsAsync();
                        }

                        // Sleep for 65 minutes to ensure we don't trigger again this hour
                        await Task.Delay(TimeSpan.FromMinutes(65), cancellationToken);
                    }
                    else
                    {
                        // Check again in 30 minutes
                        await Task.Delay(TimeSpan.FromMinutes(30), cancellationToken);
                    }
                }
                catch (TaskCanceledException) 
                {
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error in DigestHostedService loop.");
                    // Retry after 5 minutes on error
                    await Task.Delay(TimeSpan.FromMinutes(5), cancellationToken);
                }
            }
        }

        public Task StopAsync(CancellationToken cancellationToken)
        {
            return Task.CompletedTask;
        }
    }
}
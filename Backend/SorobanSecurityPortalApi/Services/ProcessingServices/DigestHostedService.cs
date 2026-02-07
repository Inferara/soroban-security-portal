using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.DependencyInjection;
using SorobanSecurityPortalApi.Common;

namespace SorobanSecurityPortalApi.Services.ProcessingServices
{
    public class DigestHostedService : BackgroundService
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

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation($"Digest Hosted Service started. Schedule: {_config.DigestDay} at {_config.DigestHour}:00 UTC.");

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    var delay = CalculateDelayUntilNextRun(_config.DigestDay, _config.DigestHour);
                    _logger.LogInformation($"Next Weekly Digest run scheduled in: {delay.TotalHours:F2} hours.");

                    await Task.Delay(delay, stoppingToken);

                    _logger.LogInformation("Starting Weekly Digest Job...");
                    
                    using (var scope = _serviceProvider.CreateScope())
                    {
                        var digestService = scope.ServiceProvider.GetRequiredService<IDigestService>();
                        await digestService.ProcessDigestsAsync();
                    }
                }
                catch (TaskCanceledException)
                {
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error in DigestHostedService loop. Retrying in 1 hour.");
                    await Task.Delay(TimeSpan.FromHours(1), stoppingToken);
                }
            }
        }

        private TimeSpan CalculateDelayUntilNextRun(DayOfWeek targetDay, int targetHour)
        {
            var now = DateTime.UtcNow;
            var today = now.Date;
            var nextRun = today;

            while (nextRun.DayOfWeek != targetDay)
            {
                nextRun = nextRun.AddDays(1);
            }

            nextRun = nextRun.AddHours(targetHour);

            if (nextRun <= now)
            {
                nextRun = nextRun.AddDays(7);
            }

            return nextRun - now;
        }
    }
}
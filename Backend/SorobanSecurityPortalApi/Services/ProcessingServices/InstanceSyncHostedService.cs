using SorobanSecurityPortalApi.Common;
using Microsoft.Extensions.DependencyInjection; 


namespace SorobanSecurityPortalApi.Services.ProcessingServices
{
    internal class InstanceSyncHostedService : IHostedService, IDisposable
    {
        private readonly IServiceScopeFactory _scopeFactory; // Use the Factory
        private Timer? _timer;

        public InstanceSyncHostedService(IServiceScopeFactory scopeFactory)
        {
            _scopeFactory = scopeFactory;
        }

        public Task StartAsync(CancellationToken cancellationToken)
        {
            var period = TimeSpan.FromSeconds(InstanceSync.TtlInSeconds - 5);
            _timer = new Timer(async _ => await Process(), null, period, period); // Safer async handling
            return Task.CompletedTask;
        }

        private async Task Process() // Changed from async void to async Task
        {
            using (var scope = _scopeFactory.CreateScope()) //Create temporary scope
            {
                var instanceSync = scope.ServiceProvider.GetRequiredService<IInstanceSync>();
                
                instanceSync.SendHeartbeat();
                if (instanceSync.IsRestartNeeded())
                {
                    Environment.Exit(0);
                }
            }
        }

        public Task StopAsync(CancellationToken cancellationToken)
        {
            _timer?.Change(Timeout.Infinite, Timeout.Infinite);
            return Task.CompletedTask;
        }

        public void Dispose()
        {
            _timer?.Dispose();
        }
    }
}


using SorobanSecurityPortalApi.Common;

namespace SorobanSecurityPortalApi.Services.ProcessingServices
{
    internal class InstanceSyncHostedService : IHostedService, IDisposable
    {
        private readonly IInstanceSync _instanceSync;
        
        private Timer? _timer;
        private bool _isMainInstance;

        public InstanceSyncHostedService(
            IInstanceSync instanceSync)
        {
            _instanceSync = instanceSync;
            _isMainInstance = _instanceSync.IsMainInstance;
        }

        public Task StartAsync(CancellationToken cancellationToken)
        {
            var period = TimeSpan.FromSeconds(InstanceSync.TtlInSeconds - 5);
            _timer = new Timer(Process, null, period, period);
            return Task.CompletedTask;
        }

        public async void Process(object? state)
        {
            _instanceSync.SendHeartbeat();
            if(_instanceSync.IsRestartNeeded())
            {
                Environment.Exit(0);
            }
        }

        public Task StopAsync(CancellationToken cancellationToken)
        {
            _timer?.Change(Timeout.InfiniteTimeSpan, Timeout.InfiniteTimeSpan);
            return Task.CompletedTask;
        }

        public void Dispose()
        {
            _timer?.Dispose();
        }
    }
}
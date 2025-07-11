using SorobanSecurityPortalApi.Common;
using Microsoft.Extensions.Caching.StackExchangeRedis;

namespace SorobanSecurityPortalApi.Services.UpdateServices;

public class UpdateService
{
    private readonly Config _config;
    private readonly ILogger<UpdateService> _logger;
    private readonly IInstanceSync _instanceSync;
    private UpdateDatabaseService _dbUpdate;
    private IHost _host;

    public UpdateService(string[] args)
    {
        _config = new Config();
        var redisOptions = new RedisCacheOptions { Configuration = $"{_config.DistributedCacheUrl},password={_config.DistributedCachePassword}" };
        _instanceSync = new InstanceSync(new CacheAccessor(new RedisCache(redisOptions)));
        _host = Host.CreateDefaultBuilder(args).Build();
        _logger = _host.Services.GetRequiredService<ILogger<UpdateService>>();
        _dbUpdate = new UpdateDatabaseService(_config, _host);
    }

    public void Update()
    {
        try
        {
            if (!IsUpdateRequired()) return;

            if (_instanceSync.IsMainInstance)
            {
                _dbUpdate.UpdateDatabase();
                _dbUpdate.SetProductVersion(_config.ProductVersion);
            }
            else
            {
                while (IsUpdateRequired())
                {
                    Thread.Sleep(5000);
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex.ToString());
            throw;
        }
    }

    private bool IsUpdateRequired()
    {
        return _dbUpdate.IsUpdateRequired();
    }
}
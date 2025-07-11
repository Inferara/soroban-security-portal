using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Common.Data;
using Microsoft.EntityFrameworkCore;
using Polly;
using System.Data.Common;

namespace SorobanSecurityPortalApi.Services.UpdateServices;

public class UpdateDatabaseService
{
    private readonly IHost _host;
    private readonly Config _config;
    private readonly IDbQuery _query;
    private readonly IDataSourceProvider _dsp;
    private readonly ILogger<UpdateDatabaseService> _logger;
    private readonly Db _dbContext;

    private const int _retryMaxCount = 5;
    private int _retryAttempt = 0;

    public UpdateDatabaseService(Config config, IHost host)
    {
        _host = host;
        _config = config;
        _query = new DbQuery(config);
        _dsp = new DataSourceProvider(config);
        _logger = _host.Services.GetRequiredService<ILogger<UpdateDatabaseService>>();
        var dbLogger = _host.Services.GetRequiredService<ILogger<Db>>();
        _dbContext = new Db(_query, dbLogger, _dsp);
    }
   
    public bool IsUpdateRequired()
    {
        if (IsDbExists() && IsDbTableSettingsExists())
        {
            return _config.ProductVersion != _query.GetProductVersion();
        }
        else
        {
            return true;
        }
    }

    public void UpdateDatabase()
    {
        if (IsDbMigrationsExist())
            MigrateDatabase();
    }

    public bool IsDbExists()
    {
        return _query.IsConfigDbExists();
    }

    public bool IsDbTableSettingsExists()
    {
        return _query.IsDbSettingsTableExists();
    }

    public void SetProductVersion(Version newVersion)
    {
        _query.SetProductVersion(newVersion);
    }

    private bool IsDbMigrationsExist()
    {
        return _dbContext.Database.GetPendingMigrations().Any();
    }

    private void MigrateDatabase()
    {
        try
        {
            Migrate();
        }
        catch (Exception ex)
        {
            //Log errors or do anything you think it's needed
            _logger.LogError($"Error occurred while database migrations: {ex}");
            throw;
        }
    }

    private void Migrate()
    {
        Policy.Handle<DbException>()
            .WaitAndRetry(_retryMaxCount, retryAttempt =>
            {
                _retryAttempt = retryAttempt;
                return TimeSpan.FromSeconds(Math.Pow(2, retryAttempt));
            })
            .Execute(() =>
            {
                _logger.LogInformation($"Check database connection availability. Attempt: {_retryAttempt}");

                if (_query.IsConfigDbExists())
                {
                    // check connection (if DB server available)
                    _dbContext.Database.OpenConnection();
                    _dbContext.Database.CloseConnection();
                    _logger.LogInformation("Database connection available. Can start migration on existing db.");
                }
                else
                {
                    _logger.LogInformation("Database does not exist. Can start migration on new db.");
                }
                                
                _logger.LogInformation("Started Database migration");
                _dbContext.Database.Migrate();
                _logger.LogInformation("Database migration completed");
            });
    }

    private void DeleteDatabase()
    {
        Policy.Handle<DbException>()
            .WaitAndRetry(_retryMaxCount, retryAttempt => TimeSpan.FromSeconds(Math.Pow(2, retryAttempt)))
            .Execute(_dbContext.Database.EnsureDeleted);
    }
}
using Npgsql;

namespace SorobanSecurityPortalApi.Common.Data
{
    public class DataSourceProvider : IDataSourceProvider
    {
        public DataSourceProvider(Config config)
        {
            var connectionString = $"Server={config.DbServer};Port={config.DbPort};User Id={config.DbUser};Password={config.DbPassword};Database={config.DbName};" +
                $"Pooling=true;Minimum Pool Size=0;Maximum Pool Size={config.DbPgPoolSize};Timeout={config.DbConnectionTimeout};CommandTimeout={config.DbTimeout};";
            var dataSourceBuilder = new NpgsqlDataSourceBuilder(connectionString);
            dataSourceBuilder.EnableDynamicJson();
            DataSource = dataSourceBuilder.Build();
        }

        public NpgsqlDataSource DataSource { get; }
    }

    public interface IDataSourceProvider
    {
        NpgsqlDataSource DataSource { get; }
    }
}
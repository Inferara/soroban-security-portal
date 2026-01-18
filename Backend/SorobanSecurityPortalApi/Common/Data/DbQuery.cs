using System.Data;
using System.Data.Common;
using SorobanSecurityPortalApi.Common.Extensions;
using SorobanSecurityPortalApi.Models.DbModels;
using Npgsql;

namespace SorobanSecurityPortalApi.Common.Data
{
    public class DbQuery : IDbQuery
    {
        private readonly Config? _config;

        public DbQuery(string connectionString)
        {
            ConnectionString = connectionString;
            LastSqlCall = string.Empty;
        }

        public DbQuery(Config config)
        {
            _config = config;
            LastSqlCall = string.Empty;
            ConnectionString = string.Empty;
            UseConfigDb();
        }
        public string ConnectionString { get; set; }
        public string LastSqlCall { get; set; }

        public void UseConfigDb() => UseDb(_config!.DbName);

        public void UsePostgresDb() => UseDb("postgres");

        private void UseDb(string dbName)
        {
            ConnectionString = $"Server={_config!.DbServer};Port={_config.DbPort};User Id={_config.DbUser};Password={_config.DbPassword};Database={dbName};" +
                               $"Pooling=true;Minimum Pool Size=0;Maximum Pool Size={_config.DbPgPoolSize};Timeout={_config.DbConnectionTimeout};CommandTimeout={_config.DbTimeout};";
        }

        public List<string> GetDatabaseNames()
        {
            UsePostgresDb();
            var result = ExecuteList<string>("select datname from pg_database;");
            UseConfigDb();
            return result;
        }

        public Version GetProductVersion()
        {
            UseConfigDb();
            var result = ExecuteScalar($"select content from settings where settings_type={(int)SettingType.Version}");
            return string.IsNullOrWhiteSpace(result) ? new Version(1,0) : Version.Parse(result);
        }

        public void SetProductVersion(Version productVersion)
        {
            UseConfigDb();
            var result = ExecuteScalar($"select content from settings where settings_type={(int)SettingType.Version}");
            if (string.IsNullOrWhiteSpace(result))
            {
                ExecuteNonQuery($"insert into settings (entity_id, settings_type, content) " +
                    $"values (null, {(int)SettingType.Version},'{productVersion.ToString(2)}')");
            }
            else
            {
                ExecuteNonQuery($"update settings set content='{productVersion.ToString(2)}' where settings_type={(int)SettingType.Version}");
            }
        }

        public void DropDatabaseIfExist(string dbName)
        {
            UsePostgresDb();
            ExecuteNonQuery($@"drop database if exists ""{dbName.SqlSafe()}"";");
            UseConfigDb();
        }

        public bool IsConfigDbExists()
        {
            UsePostgresDb();
            var result = ExecuteScalar($@"select exists(select datname from pg_database where datname =  '{_config!.DbName.SqlSafe()}')");
            UseConfigDb();
            return Convert.ToBoolean(result);
        }

        public bool IsDbSettingsTableExists()
        {
            UseConfigDb();
            var result = TableExists(nameof(Db.Settings).ToSnakeCase());
            return result;
        }

        public void RevokeConnect(string dbName)
        {
            UsePostgresDb();
            ExecuteNonQuery($@"revoke connect on database ""{dbName.SqlSafe()}"" from public;");
            UseConfigDb();
        }

        public void TerminateConnections(string dbName)
        {
            UsePostgresDb();
            ExecuteNonQuery($@"
                select 
		                pg_terminate_backend(pg_stat_activity.pid)
	                from 
		                pg_stat_activity
	                where 
		                pg_stat_activity.datname = '{dbName.SqlSafe()}'
		                and pid <> pg_backend_pid();");
            UseConfigDb();
        }

        public void CreateFromDb(string dbName, string dbFrom)
        {
            UsePostgresDb();
            ExecuteNonQuery($@"create database ""{dbName.SqlSafe()}"" with template ""{dbFrom.SqlSafe()}"" owner '{_config!.DbUser}';");
            UseConfigDb();
        }

        public void RemoveBackup(string backupName)
        {
            var databaseNames = GetDatabaseNames();
            if (databaseNames.Any(dbName => dbName.ToLower() == backupName.ToLower()))
            {
                RevokeConnect(backupName);
                TerminateConnections(backupName);
                DropDatabaseIfExist(backupName);
            }
        }

        public void Backup(string backupName)
        {
            var databaseNames = GetDatabaseNames();
            if (databaseNames.Any(dbName => dbName.ToLower() == backupName.ToLower()))
            {
                RevokeConnect(backupName);
                TerminateConnections(backupName);
                DropDatabaseIfExist(backupName);
            }
            RevokeConnect(_config!.DbName);
            TerminateConnections(_config.DbName);
            CreateFromDb(backupName, _config.DbName);
        }

        public void Restore(string backupName)
        {
            var databaseNames = GetDatabaseNames();
            if (databaseNames.All(dbName => dbName.ToLower() != backupName.ToLower()))
                return;

            RevokeConnect(_config!.DbName);
            TerminateConnections(_config.DbName);
            DropDatabaseIfExist(_config.DbName);

            RevokeConnect(backupName);
            TerminateConnections(backupName);
            CreateFromDb(_config.DbName, backupName);
        }

        public int ExecuteNonQuery(string sqlCommand)
        {
            LastSqlCall = sqlCommand;
            using var connection = new NpgsqlConnection(ConnectionString);
            connection.Open();
            using var command = new NpgsqlCommand(sqlCommand, connection) { CommandTimeout = _config?.DbTimeout ?? 600 };
            return command.ExecuteNonQuery();
        }

        public void ExecuteScript(string scriptPath, Dictionary<string, string> replacements, string preScript = "")
        {
            if (File.Exists(scriptPath))
            {
                var scriptLines = File.ReadAllLines(scriptPath);
                var currentScriptPart = preScript + Environment.NewLine;
                foreach (var scriptLine in scriptLines)
                {
                    if (scriptLine.Trim().ToLower() == "go")
                    {
                        currentScriptPart = replacements
                            .Aggregate(currentScriptPart, (current, replacement) => current.Replace(replacement.Key, replacement.Value));
                        ExecuteNonQuery(currentScriptPart);
                        currentScriptPart = string.Empty;
                    }
                    else
                    {
                        currentScriptPart += scriptLine + Environment.NewLine;
                    }
                }
            }
        }

        public int GetRowCount(string sqlCommand)
        {
            sqlCommand = $@"select count(*) from
                (
                    {sqlCommand}	
                ) qry{new Random().Next(1000, 9999)}";

            return Convert.ToInt32(ExecuteScalar(sqlCommand));
        }

        public DataTable ExecuteTable(string sqlCommand, int page, int pageSize)
        {
            sqlCommand = $@"{sqlCommand}
	            order by 1 desc limit {pageSize} offset {(page - 1) * pageSize};";
            return ExecuteTable(sqlCommand);
        }

        public DataTable ExecuteTable(string sqlCommand)
        {
            LastSqlCall = sqlCommand;
            var result = new DataTable();
            using (var connection = new NpgsqlConnection(ConnectionString))
            {
                var adapter = new NpgsqlDataAdapter(sqlCommand, connection);
                if (adapter.SelectCommand != null)
                    adapter.SelectCommand.CommandTimeout = _config?.DbTimeout ?? 600;
                adapter.Fill(result);
            }
            return result;
        }

        public DataRow? ExecuteRow(string sqlCommand)
        {
            var table = ExecuteTable(sqlCommand);
            return table.Rows.Count > 0 ? table.Rows[0] : null;
        }

        public string? ExecuteScalar(string sqlCommand)
        {
            LastSqlCall = sqlCommand;
            using var connection = new NpgsqlConnection(ConnectionString);
            connection.Open();
            using var command = new NpgsqlCommand(sqlCommand, connection) { CommandTimeout = _config?.DbTimeout ?? 600 };
            return Convert.ToString(command.ExecuteScalar());
        }

        public List<T> ExecuteList<T>(string sqlCommand)
        {
            return ExecuteTable(sqlCommand).Rows.Cast<DataRow>().Select(resultRow => (T)Convert.ChangeType(resultRow[0], typeof(T))).ToList();
        }

        public T? GetValue<T>(DataRow row, string columnName, T? defaultValue = default)
        {
            if (row == null || !row.Table.Columns.Contains(columnName) || row[columnName] == DBNull.Value)
            {
                return defaultValue;
            }
            return (T)Convert.ChangeType(row[columnName], typeof(T));
        }

        public bool TableExists(string tableName, string schemaName = "public")
        {
            var sqlCommand = $@"select exists (
select table_name from information_schema.tables 
where table_name = '{tableName.SqlSafe()}' and table_schema = '{schemaName.SqlSafe()}')";

            return Convert.ToBoolean(ExecuteScalar(sqlCommand));
        }
    }

    public interface IDbQuery
    {
        string ConnectionString { get; set; }
        public string LastSqlCall { get; set; }
        void UseConfigDb();
        void UsePostgresDb();
        Version GetProductVersion();
        void SetProductVersion(Version productVersion);
        List<string> GetDatabaseNames();
        bool IsConfigDbExists();
        bool IsDbSettingsTableExists();
        void DropDatabaseIfExist(string dbName);
        void RevokeConnect(string dbName);
        void TerminateConnections(string dbName);
        void CreateFromDb(string dbName, string dbFrom);
        void Backup(string backupName);
        void RemoveBackup(string backupName);
        void Restore(string backupName);
        int ExecuteNonQuery(string sqlCommand);
        void ExecuteScript(string scriptPath, Dictionary<string, string> replacements, string preScript = "");
        int GetRowCount(string sqlCommand);
        DataTable ExecuteTable(string sqlCommand);
        DataRow? ExecuteRow(string sqlCommand);
        string? ExecuteScalar(string sqlCommand);
        List<T> ExecuteList<T>(string sqlCommand);
        T? GetValue<T>(DataRow row, string columnName, T? defaultValue = default);
        bool TableExists(string tableName, string schemaName = "public");
    }
}
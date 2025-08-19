using SorobanSecurityPortalApi.Common.Extensions;
namespace SorobanSecurityPortalApi.Common;

public class Config
{
    public Config(): this(File.ReadAllText("appsettings.json")) { }

    public Config(string appSettings)
    {
        var version = GetValue<string>(appSettings, "ProductVersion");
        ProductVersion = string.IsNullOrWhiteSpace(version) ? new Version(1, 0) : Version.Parse(version);
        DbConnectionTimeout = GetValue<int>(appSettings, "DbConnectionTimeout");
        DbServer = GetValue<string>(appSettings, "DbServer");
        DbPort = GetValue<int>(appSettings, "DbPort");
        DbName = GetValue<string>(appSettings, "DbName");
        DbUser = GetValue<string>(appSettings, "DbUser");
        DbPassword = GetValue<string>(appSettings, "DbPassword");
        DbTimeout = GetValue<int>(appSettings, "DbTimeout");
        DbPgPoolSize = GetValue<int>(appSettings, "DbPgPoolSize");
        AutoCompactLargeObjectHeap = GetValue<bool>(appSettings, "AutoCompactLargeObjectHeap");
        DistributedCacheUrl = GetValue<string>(appSettings, "DistributedCacheUrl");
        DistributedCachePassword = GetValue<string>(appSettings, "DistributedCachePassword");
        AppUrl = GetValue<string>(appSettings, "AppUrl");
    }

    private T GetValue<T>(string config, string key)
    {
        var environmentValue = Environment.GetEnvironmentVariable(key.ToUpper());
        if (environmentValue == null)
        {
            var value = config.JsonGet<T>(key);
            if (value != null)
                return value;
            throw new Exception($"Config key {key} not found");
        }
        return (T) Convert.ChangeType(environmentValue, typeof(T));
    }

    public Version ProductVersion { get; set; }
    public string DbServer { get; set; }
    public int DbPort { get; set; }
    public string DbName { get; set; }
    public string DbUser { get; set; }
    public string DbPassword { get; set; }
    public int DbTimeout { get; set; }
    public int DbPgPoolSize { get; set; }
    public int DbConnectionTimeout { get; set; }
    public bool AutoCompactLargeObjectHeap { get; set; }
    public string DistributedCacheUrl { get; set; }
    public string DistributedCachePassword { get; set; }
    public string AppUrl { get; set; }
}
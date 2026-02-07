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

        // --- Weekly Digest Configuration ---
        var dayStr = GetValueOrDefault<string>(appSettings, "DigestDayOfWeek", "Friday");
        DigestDay = Enum.TryParse<DayOfWeek>(dayStr, true, out var d) ? d : DayOfWeek.Friday;

        DigestHour = GetValueOrDefault<int>(appSettings, "DigestHourUtc", 9); 
        
        FrontendUrl = GetValueOrDefault<string>(appSettings, "FrontendUrl", "https://portal.soroban.com");
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

    private T GetValueOrDefault<T>(string config, string key, T defaultValue)
    {
        try
        {
            return GetValue<T>(config, key);
        }
        catch
        {
            return defaultValue;
        }
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
    public DayOfWeek DigestDay { get; set; }
    public int DigestHour { get; set; }
    public string FrontendUrl { get; set; }
}
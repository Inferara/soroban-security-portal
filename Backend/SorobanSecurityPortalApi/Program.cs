using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Services.ProcessingServices;
using SorobanSecurityPortalApi.Services.UpdateServices;

namespace SorobanSecurityPortalApi;

public class Program
{
    public static void Main(string[] args)
    {
        new UpdateService(args).Update();
        CreateHostBuilder(args).Build().Run();
    }

    public static IHostBuilder CreateHostBuilder(string[] args)
    {

        var hostBuilder =
            IsDesignTime()
              ? Host.CreateDefaultBuilder(args)
                  .ConfigureServices(services =>
                  {
                      var config = new Config();
                      services.AddSingleton(config);
                      services.AddTransient<IDbQuery, DbQuery>();
                      services.AddTransient<IDataSourceProvider, DataSourceProvider>();
                      services.AddTransient<Db>();
                  })
              : Host.CreateDefaultBuilder(args)
                  .ConfigureWebHostDefaults(builder => builder.UseStartup<Startup>())
                  .ConfigureServices(services =>
                  {
                      services.AddHostedService<InstanceSyncHostedService>();
                      services.AddHostedService<BackgroundWorkingHostedService>();
                  });

        return hostBuilder;
    }

    public static bool IsDesignTime()
    {
        var args = Environment.GetCommandLineArgs();
        if (args.Length < 1)
        {
            return false;
        }
        var arg = args[0];
        return Path.GetFileName(arg) == "ef.dll" || Path.GetFileName(arg) == "ef.so";
    }
}
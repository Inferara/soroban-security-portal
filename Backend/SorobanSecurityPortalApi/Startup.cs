using SorobanSecurityPortalApi.Common;
using System.Reflection;
using SorobanSecurityPortalApi.Authorization;
using HealthChecks.UI.Client;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using SorobanSecurityPortalApi.Common.Extensions;
using SorobanSecurityPortalApi.Common.Data;
using AspNetCore.Authentication.Basic;
using Microsoft.OpenApi.Models;
using SorobanSecurityPortalApi.Services.ControllersServices;

namespace SorobanSecurityPortalApi;

public class Startup
{
    private readonly Config _config;
    private static ILogger<Startup>? _logger;
    public Startup(IConfiguration configuration)
    {
        _config = new Config();
    }

    public void ConfigureServices(IServiceCollection services)
    {
        AddServices(services);
        services.AddControllers();
    }

    private void AddServices(IServiceCollection services)
    {
        services.AddCors(options =>
        {
            options.AddPolicy("CorsPolicy", builder => builder
                .AllowAnyOrigin()
                .AllowAnyMethod()
                .AllowAnyHeader()
            );
        });

        services.AddSingleton(_config);
        services.AddSingleton<IDataSourceProvider, DataSourceProvider>(e => new DataSourceProvider(_config));
        services.ForInterfacesMatching("^I.*Processor$")
            .OfAssemblies(Assembly.GetExecutingAssembly())
            .AddScoped();
        services.ForInterfacesMatching("^I(?!.*Processor$).*")
            .OfAssemblies(Assembly.GetExecutingAssembly())
            .AddTransients();

        services.AddScoped<IRatingService, RatingService>();

        services.AddStackExchangeRedisCache(options =>
        {
            options.Configuration = _config.DistributedCacheUrl;
            options.ConfigurationOptions = new StackExchange.Redis.ConfigurationOptions
            {
                EndPoints = { _config.DistributedCacheUrl },
                Password = _config.DistributedCachePassword,
            };
        });
        services.AddScoped<Db>();
        services.AddDbContextFactory<Db>();
        services.AddHttpContextAccessor();
        services.AddSingleton(sp => sp);
        services.AddScoped<UserContextAccessor>();
        services.AddScoped<IUserContextAccessor>(sp => sp.GetRequiredService<UserContextAccessor>());
        services.AddSingleton<ExtendedConfig>();
        services.AddSingleton<IExtendedConfig>(sp => sp.GetRequiredService<ExtendedConfig>());
        var serviceProvider = services.BuildServiceProvider();
        _logger = serviceProvider.GetRequiredService<ILogger<Startup>>();
        var extendedConfig = serviceProvider.GetRequiredService<ExtendedConfig>();

        var tokenValidationParameters = new TokenValidationParameters
        {
            ValidateAudience = true,
            ValidateIssuer = true,
            ValidateLifetime = true,
            LifetimeValidator = (notBefore, expires, _, _) => notBefore <= DateTime.UtcNow && expires > DateTime.UtcNow,
            ValidateIssuerSigningKey = true,
            ValidAudience = extendedConfig.AuthAudience,
            ValidIssuer = extendedConfig.AuthIssuer,
            IssuerSigningKey = extendedConfig.AuthSecurityKey.GetSymmetricSecurityKey(),
            ClockSkew = TimeSpan.Zero,
        };
        services.AddSingleton(tokenValidationParameters);
        services.AddHttpContextAccessor();
        services.AddScoped<HttpCallHandler>();
        services.AddHttpClients(extendedConfig, _logger);
        
        var combinedAuthenticationScheme = "Combined";
        services.AddAuthentication(options =>
        {
            options.DefaultAuthenticateScheme = combinedAuthenticationScheme;
            options.DefaultChallengeScheme = combinedAuthenticationScheme;
            options.DefaultScheme = combinedAuthenticationScheme;
        })
            .AddPolicyScheme(combinedAuthenticationScheme, "Bearer / Basic", options =>
            {
                options.ForwardDefaultSelector = context =>
                {
                    var isCombinedAuthorize = context.GetEndpoint()?.Metadata.FirstOrDefault(x => x.GetType() == typeof(CombinedAuthorizeAttribute)) != null;
                    var header = (string?)context.Request.Headers.Authorization ?? "";
                    if (header.StartsWith("Basic") && isCombinedAuthorize)
                        return BasicDefaults.AuthenticationScheme;
                    return JwtBearerDefaults.AuthenticationScheme;
                };
            })
            .AddJwtBearer(options => { options.TokenValidationParameters = tokenValidationParameters; })
            .AddBasic<BasicUserValidationService>(options => { options.SuppressWWWAuthenticateHeader = true; });

        services.AddAutoMapper(typeof(Startup));
        services.AddHealthChecks();
        services.AddControllers().AddNewtonsoftJson(options => options.SerializerSettings.ReferenceLoopHandling = Newtonsoft.Json.ReferenceLoopHandling.Ignore);
        services.AddEndpointsApiExplorer();
        services.AddSwaggerGen(options =>
        {
            options.SwaggerDoc("v1", new OpenApiInfo
            {
                Version = "v1",
                Title = "Soroban Security Portal API",
                Description = "API to work with Soroban Security Portal. Most endpoints are for administration and configuration. Its required to use Auth Code Flow + PKCE to use them.\n\n" +
                    "Endpoint for API integration using Basic Authentication:\n\n" +
                    "/api/v1/agents/{agentName}/isEnabled\n\n" +
                    "/api/v1/tags/my\n\n" +
                    "/api/v1/copilot/chat\n\n" +
                    "/api/v1/copilot/search\n\n" +
                    "/api/v1/copilot/transcript",
                Contact = new OpenApiContact
                {
                    Name = "SorobanSecurityPortal",
                    Url = new Uri("https://domain.com")
                },
            });
            options.EnableAnnotations();
            options.AddSecurityDefinition("Basic", new OpenApiSecurityScheme
            {
                Name = "Authorization",
                Type = SecuritySchemeType.Http,
                Scheme = "Basic",
                In = ParameterLocation.Header,
                Description = "Basic Authorization header, login:password encoded with Base64."
            });
            options.AddSecurityRequirement(new OpenApiSecurityRequirement
            {
                {
                    new OpenApiSecurityScheme
                    {
                        Reference = new OpenApiReference
                        {
                            Type = ReferenceType.SecurityScheme,
                            Id = "Basic"
                        }
                    },
                    new string[] {}
                }
            });
        });
    }

    public void Configure(IApplicationBuilder app, IWebHostEnvironment env)
    {
        app.Use((context, next) =>
        {
            context.Request.EnableBuffering();
            return next();
        });
        app.UseCors("CorsPolicy");
        app.UseRouting();
        app.UseSwagger(options =>
        {
            options.RouteTemplate = "/api/swagger/{documentName}/swagger.json";
        });
        app.UseSwaggerUI(options =>
        {
            options.RoutePrefix = "api/swagger";
        });
        app.UseAuthentication();
        app.UseAuthorization();

        app.UseMiddleware<ExceptionHandlingMiddleware>();

        app.UseEndpoints(endpoints =>
        {
            endpoints.MapControllers();
            endpoints.MapHealthChecks("/health", new HealthCheckOptions
            {
                ResponseWriter = UIResponseWriter.WriteHealthCheckUIResponse
            });
        });
    }


}
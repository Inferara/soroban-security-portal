using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Common.Caching;
using System.Reflection;
using SorobanSecurityPortalApi.Authorization;
using HealthChecks.UI.Client;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using SorobanSecurityPortalApi.Common.Extensions;
using SorobanSecurityPortalApi.Common.Data;
using AspNetCore.Authentication.Basic;
using Microsoft.OpenApi;
using SorobanSecurityPortalApi.Services.ControllersServices;
using SorobanSecurityPortalApi.Services.Moderation;
using SorobanSecurityPortalApi.Services.Realtime;
using SorobanSecurityPortalApi.Services.PublicApi;
using SorobanSecurityPortalApi.Mcp;
using Microsoft.AspNetCore.Authorization;
using ModelContextProtocol.Protocol;

namespace SorobanSecurityPortalApi;

public class Startup
{
    private readonly Config _config;
    private static ILogger<Startup>? _logger;
    private const string PublicApiPolicy = "PublicApi";
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
                .WithExposedHeaders("X-Total-Count")
            );
        });

        services.AddSingleton(_config);
        services.AddMemoryCache();
        services.AddSingleton<ILookupCache, LookupCache>();
        services.AddSingleton<IDataSourceProvider, DataSourceProvider>(e => new DataSourceProvider(_config));
        services.ForInterfacesMatching("^I.*Processor$")
            .OfAssemblies(Assembly.GetExecutingAssembly())
            .AddScoped();
        // ContentFilterService is registered before the convention scan so the scan skips it (sees it already registered).
        // Singleton is safe: ModerationLogProcessor uses IDbContextFactory (creates its own DbContext per call),
        // IExtendedConfig and ICacheAccessor are also singleton-safe. The expensive file I/O and sanitizer
        // construction are handled by static Lazy fields inside the service.
        services.AddSingleton<IContentFilterService, ContentFilterService>();

        // Explicit Scoped registration before the convention scan so the scan skips IRatingService.
        // Scoped is correct: RatingService depends on Db (DbContext) which is Scoped.
        services.AddScoped<IRatingService, RatingService>();
        // Explicit Scoped registration before the convention scan so the scan skips ICommentService.
        services.AddScoped<ICommentService, CommentService>();
        services.AddScoped<IVoteService, VoteService>();
        services.AddScoped<INotificationService, NotificationService>();
        services.AddScoped<IRealtimePublisher, SignalRNotificationPublisher>();

        // Moderation target resolvers registered before the convention scan so the scan skips them.
        // Multiple IModerationTarget registrations are intentional: ModerationTargetRegistry collects all via IEnumerable<IModerationTarget>.
        services.AddScoped<IModerationTarget, VulnerabilityModerationTarget>();
        services.AddScoped<IModerationTarget, ReportModerationTarget>();
        services.AddScoped<IModerationTarget, RatingModerationTarget>();
        services.AddScoped<IModerationTarget, CommentModerationTarget>();
        services.AddScoped<IModerationTargetRegistry, ModerationTargetRegistry>();

        // Public API rate limiter: one instance for the whole process (it holds the counters),
        // registered before the convention scan so the scan skips it.
        services.AddSingleton<IApiRateLimiter, ApiRateLimiter>();
        services.AddSingleton<QueryEmbeddingCache>();

        services.ForInterfacesMatching("^I(?!.*Processor$).*")
            .OfAssemblies(Assembly.GetExecutingAssembly())
            .AddTransients();

        services.AddStackExchangeRedisCache(options =>
        {
            options.Configuration = _config.DistributedCacheUrl;
            options.ConfigurationOptions = new StackExchange.Redis.ConfigurationOptions
            {
                EndPoints = { _config.DistributedCacheUrl },
                Password = _config.DistributedCachePassword,
            };
        });
        services.AddSignalR(options =>
        {
            // Ping connected clients every 15s so the browser's serverTimeout
            // (60s, see notificationConnection.ts) is never tripped during quiet
            // periods, and give the server 60s before it considers a client gone.
            options.KeepAliveInterval = TimeSpan.FromSeconds(15);
            options.ClientTimeoutInterval = TimeSpan.FromSeconds(60);
        }).AddStackExchangeRedis(options =>
        {
            options.Configuration = new StackExchange.Redis.ConfigurationOptions
            {
                EndPoints = { _config.DistributedCacheUrl },
                Password = _config.DistributedCachePassword,
                AbortOnConnectFail = false
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
                    // The public surface (MCP + public REST) is the only place API keys are accepted.
                    if (ApiKeyAuthenticationHandler.IsPublicApiPath(context.Request.Path))
                        return ApiKeyAuthenticationHandler.SchemeName;
                    var header = (string?)context.Request.Headers.Authorization ?? "";
                    if (header.StartsWith("Basic") && isCombinedAuthorize)
                        return BasicDefaults.AuthenticationScheme;
                    return JwtBearerDefaults.AuthenticationScheme;
                };
            })
            .AddJwtBearer(options =>
            {
                options.TokenValidationParameters = tokenValidationParameters;
                // SignalR sends the JWT on the websocket handshake as ?access_token=...
                options.Events = new Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerEvents
                {
                    OnMessageReceived = context =>
                    {
                        var accessToken = context.Request.Query["access_token"];
                        var path = context.HttpContext.Request.Path;
                        if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
                            context.Token = accessToken;
                        return Task.CompletedTask;
                    }
                };
            })
            .AddBasic<BasicUserValidationService>(options => { options.SuppressWWWAuthenticateHeader = true; })
            .AddScheme<Microsoft.AspNetCore.Authentication.AuthenticationSchemeOptions, ApiKeyAuthenticationHandler>(
                ApiKeyAuthenticationHandler.SchemeName, _ => { });

        services.AddAuthorization(options =>
        {
            options.AddPolicy(PublicApiPolicy, policy => policy
                .AddAuthenticationSchemes(ApiKeyAuthenticationHandler.SchemeName)
                .RequireAuthenticatedUser());
        });

        // MCP server for AI agents, served at /api/mcp (see Mcp/PortalMcpTools.cs).
        // Stateless: every request stands alone, so there is no session to pin to an instance
        // and each tool call runs inside its own HTTP request (API key, limits, usage log).
        services.AddMcpServer(options =>
            {
                options.ServerInfo = new Implementation
                {
                    Name = PortalMcpTools.ServerName,
                    Title = "Stellar Security Portal",
                    Version = _config.ProductVersion.ToString(),
                };
                options.ServerInstructions = PortalMcpTools.ServerInstructions;
            })
            .WithHttpTransport(options => options.Stateless = true)
            .WithTools<PortalMcpTools>();

        services.AddAutoMapper(_ => { }, Assembly.GetExecutingAssembly());
        services.AddHealthChecks();
        services.AddControllers().AddNewtonsoftJson(options => options.SerializerSettings.ReferenceLoopHandling = Newtonsoft.Json.ReferenceLoopHandling.Ignore);
        services.AddEndpointsApiExplorer();
        services.AddSwaggerGen(options =>
        {
            options.SwaggerDoc("v1", new OpenApiInfo
            {
                Version = "v1",
                Title = "Stellar Security Portal API",
                Description = "API to work with Stellar Security Portal. Most endpoints are for administration and configuration. Its required to use Auth Code Flow + PKCE to use them.\n\n" +
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
            options.SwaggerDoc(PublicApiDocument.Name, new OpenApiInfo
            {
                Version = "v1",
                Title = "Stellar Security Portal - Public API",
                Description = "Read-only access to the portal's audit findings, audit reports, protocols, auditors and companies.\n\n" +
                    "Every call needs an API key. Sign in to the portal, open your profile and create one, then send it as " +
                    "`Authorization: Bearer <key>` (or `X-API-Key: <key>`).\n\n" +
                    "Calls are limited per key (per minute and per day). When a limit is hit the API answers `429` with a `Retry-After` header.\n\n" +
                    "The same operations are available to AI agents as MCP tools at `/api/mcp`.",
            });
            // Controllers tagged with the public group go to the public document; everything else stays in v1.
            options.DocInclusionPredicate((documentName, api) =>
                documentName == PublicApiDocument.Name
                    ? api.GroupName == PublicApiDocument.Name
                    : api.GroupName != PublicApiDocument.Name);
            options.EnableAnnotations();
            options.AddSecurityDefinition("ApiKey", new OpenApiSecurityScheme
            {
                Name = "Authorization",
                Type = SecuritySchemeType.Http,
                Scheme = "bearer",
                BearerFormat = "ssp_...",
                In = ParameterLocation.Header,
                Description = "API key created on your portal profile page."
            });
            options.AddSecurityDefinition("Basic", new OpenApiSecurityScheme
            {
                Name = "Authorization",
                Type = SecuritySchemeType.Http,
                Scheme = "Basic",
                In = ParameterLocation.Header,
                Description = "Basic Authorization header, login:password encoded with Base64."
            });
            options.AddSecurityRequirement(document => new OpenApiSecurityRequirement
            {
                {
                    new OpenApiSecuritySchemeReference(
                        document.Info?.Title?.Contains("Public API") == true ? "ApiKey" : "Basic", document, null),
                    new List<string>()
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
            options.SwaggerEndpoint($"{PublicApiDocument.Name}/swagger.json", "Public API v1");
            options.SwaggerEndpoint("v1/swagger.json", "Portal API (internal)");
        });
        app.UseAuthentication();
        app.UseAuthorization();

        app.UseMiddleware<ExceptionHandlingMiddleware>();

        app.UseEndpoints(endpoints =>
        {
            endpoints.MapControllers();
            endpoints.MapHub<SorobanSecurityPortalApi.Hubs.NotificationHub>("/hubs/notifications");
            endpoints.MapMcp("/api/mcp").RequireAuthorization(PublicApiPolicy);
            endpoints.MapHealthChecks("/health", new HealthCheckOptions
            {
                ResponseWriter = UIResponseWriter.WriteHealthCheckUIResponse
            });
        });
    }


}

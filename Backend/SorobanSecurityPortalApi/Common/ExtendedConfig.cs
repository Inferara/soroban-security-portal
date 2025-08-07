using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.DbModels;
using Json.Schema.Generation;
using Json.Schema.Generation.Intents;
using System.Collections.Concurrent;
using DescriptionAttribute = Json.Schema.Generation.DescriptionAttribute;
using Newtonsoft.Json.Linq;

namespace SorobanSecurityPortalApi.Common;

public class ExtendedConfig
{
    private DateTime _nextRefresh = DateTime.MinValue;
    private ConcurrentDictionary<string, string> _configValues = new();
    private readonly ISettingsProcessor _settingsProcessor;
    private const int RefreshTimeSec = 15;
    private readonly object _lock = new();

    private readonly string _appSettings = File.ReadAllText("appsettings.json");

    public ExtendedConfig(ISettingsProcessor settingsProcessor)
    {
        _settingsProcessor = settingsProcessor;
    }

    public void Reset()
    {
        lock (_lock)
        {
            if (DateTime.Now > _nextRefresh)
            {
                _configValues = new ConcurrentDictionary<string, string>(_settingsProcessor.Get(SettingType.Common));
                _nextRefresh = DateTime.Now.AddSeconds(RefreshTimeSec);
            }
        }
    }

    private T GetValue<T>(string key) => GetValue(key, default(T));
    private T GetValue<T>(string key, T defaultValue)
    {
        if (DateTime.Now > _nextRefresh)
            Reset();

        if (!_configValues.TryGetValue(key, out var value))
        {
            value = Environment.GetEnvironmentVariable(key.ToUpper());
        }
        if (value != null)
            return (T)Convert.ChangeType(value, typeof(T));

        var val = JObject.Parse(_appSettings).SelectToken(key);
        if (val != null)
            return val.ToObject<T>()!;
        if (defaultValue != null)
            return defaultValue;
        return default;
    }

    [Category(CategoryAttribute.ConfigCategoryEnum.Common)]
    [Description("Proxy")]
    [Tooltip("Proxy is used to route all requests through a proxy server. Can be used for debug purposes, i.e. to use Fiddler. Sample: http://host.docker.internal:8888")]
    public string Proxy => GetValue<string>("Proxy");

    [Category(CategoryAttribute.ConfigCategoryEnum.Authentication)]
    [DataType(DataTypeAttribute.ConfigDataTypeEnum.Int)]
    [Description("Token expiration time in minutes")]
    [Tooltip("The regular token expiration time specifies the duration in minutes after which the token becomes invalid. Once expired, the user must log in again. Each time a new access token is obtained using a refresh token, session lifetime is renewed.")]
    public int TokenExpirationTimeMinutes => GetValue<int>("TokenExpirationTimeMinutes");

    [Category(CategoryAttribute.ConfigCategoryEnum.Authentication)]
    [DataType(DataTypeAttribute.ConfigDataTypeEnum.Int)]
    [Description("Permanent Refresh Token expiration time in days")]
    [Tooltip("The permanent refresh token expiration time determines the number of days before a permanent refresh token becomes invalid. This is used in scenarios requiring long-lived tokens, such as external applications using OIDC for login. Each time the new access token generated, the refresh token lifetime is extended.")]
    public int PermanentTokenExpirationTimeDays => GetValue<int>("PermanentTokenExpirationTimeDays", 365);
    
    [Category(CategoryAttribute.ConfigCategoryEnum.Authentication)]
    [Description("Auth Issuer")]
    [Tooltip("The Auth Issuer is used to specify the issuer of the authentication token. This is used to verify the token.")]
    public string AuthIssuer => GetValue<string>("AuthIssuer");

    [Category(CategoryAttribute.ConfigCategoryEnum.Authentication)]
    [Description("Auth Audience")]
    [Tooltip("The Auth Audience is used to specify the audience of the authentication token. This is used to verify the token.")]
    public string AuthAudience => GetValue<string>("AuthAudience");

    [Category(CategoryAttribute.ConfigCategoryEnum.Authentication)]
    [DataType(DataTypeAttribute.ConfigDataTypeEnum.Password)]
    [Description("Auth security key")]
    [Tooltip("The Auth Security Key serves as a security key for the SHA-256 hashing algorithm during the creation of access tokens to sign-in JWT token.")]
    public string AuthSecurityKey => GetValue<string>("AuthSecurityKey");

    [Category(CategoryAttribute.ConfigCategoryEnum.Authentication)]
    [Description("Google App Client Id (Google SSO)")]
    [Tooltip("The Google Client Id is used to authenticate the application with the Google SSO service.")]
    public string GoogleClientId => GetValue<string>("GoogleClientId");

    [Category(CategoryAttribute.ConfigCategoryEnum.Authentication)]
    [DataType(DataTypeAttribute.ConfigDataTypeEnum.Password)]
    [Description("Google App Client Secret (Google SSO)")]
    [Tooltip("The Google Client Secret is used to authenticate the application with the Google SSO service.")]
    public string GoogleClientSecret => GetValue<string>("GoogleClientSecret");

    [Category(CategoryAttribute.ConfigCategoryEnum.Authentication)]
    [Description("Discord App Client Id (Discord SSO)")]
    [Tooltip("The Discord Client Id is used to authenticate the application with the Discord SSO service.")]
    public string DiscordClientId => GetValue<string>("DiscordClientId");

    [Category(CategoryAttribute.ConfigCategoryEnum.Authentication)]
    [DataType(DataTypeAttribute.ConfigDataTypeEnum.Password)]
    [Description("Discord App Secret (Discord SSO)")]
    [Tooltip("The Discord Client Secret is used to authenticate the application with the Discord SSO service.")]
    public string DiscordClientSecret => GetValue<string>("DiscordClientSecret");

    [Category(CategoryAttribute.ConfigCategoryEnum.Authentication)]
    [DataType(DataTypeAttribute.ConfigDataTypeEnum.Boolean)]
    [Description("Allow Basic Auth for Chat / Search")]
    [Tooltip("Specifies if Basic Authentication is allowed for Chat and Search. When enabled, the user can log in using a username and password. Only a few endpoints are available with Basic auth.")]
    public bool AllowBasicAuth => GetValue<bool>("AllowBasicAuth", true);

    [Category(CategoryAttribute.ConfigCategoryEnum.Search)]
    [DataType(DataTypeAttribute.ConfigDataTypeEnum.String)]
    [Description("Embedding Model")]
    [Tooltip("The Embedding Model is used to generate embeddings for the text. This is used for search and chat features. Supported models: `text-embedding-3-small`, `text-embedding-3-large`, `gemini-embedding-text-v1`")]
    public string GeminiEmbeddingModel => GetValue<string>("GeminiEmbeddingModel", "");

    [Category(CategoryAttribute.ConfigCategoryEnum.Search)]
    [DataType(DataTypeAttribute.ConfigDataTypeEnum.Password)]
    [Description("Gemini API Key")]
    [Tooltip("The Gemini API Key is used to authenticate the application with the Gemini API service. This is required for using the Gemini embedding model and other Gemini features.")]
    public string GeminiApiKey => GetValue<string>("GeminiApiKey", "");
}

[AttributeUsage(AttributeTargets.Property)]
public class DataTypeAttribute : Attribute, IAttributeHandler
{
    public DataTypeAttribute() { }

    public ConfigDataTypeEnum DataType { get; }
    public string[]? Options { get; }
    public DataTypeAttribute(ConfigDataTypeEnum dataType)
    {
        DataType = dataType;
    }

    public DataTypeAttribute(ConfigDataTypeEnum dataType, string[] options) : this(dataType)
    {
        Options = options;
    }

    void IAttributeHandler.AddConstraints(SchemaGenerationContextBase context, Attribute attribute)
    {
        context.Intents.Add(new DescriptionIntent(DataType.ToString()));
    }

    public enum ConfigDataTypeEnum
    {
        String,
        Password,
        Int,
        Boolean,
        Double,
        Url,
        Color,
        Hidden,
        Link,
        Dropdown
    }
}

[AttributeUsage(AttributeTargets.Property)]
public class TooltipAttribute : Attribute, IAttributeHandler
{
    public string TooltipText { get; }
    public TooltipAttribute(string tooltipText)
    {
        TooltipText = tooltipText;
    }

    void IAttributeHandler.AddConstraints(SchemaGenerationContextBase context, Attribute attribute)
    {
        context.Intents.Add(new DescriptionIntent(TooltipText));
    }
}

[AttributeUsage(AttributeTargets.Property)]
public class CategoryAttribute : Attribute, IAttributeHandler
{
    public CategoryAttribute() { }

    public ConfigCategoryEnum Category { get; }
    public CategoryAttribute(ConfigCategoryEnum category)
    {
        Category = category;
    }

    void IAttributeHandler.AddConstraints(SchemaGenerationContextBase context, Attribute attribute)
    {
        context.Intents.Add(new DescriptionIntent(Category.ToString()));
    }

    public enum ConfigCategoryEnum
    {
        [System.ComponentModel.Description("Common settings")]
        Common,
        [System.ComponentModel.Description("Authentication")]
        Authentication,
        [System.ComponentModel.Description("Search")]
        Search,
    }
}
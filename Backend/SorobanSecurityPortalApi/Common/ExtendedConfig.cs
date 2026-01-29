using Microsoft.Extensions.DependencyInjection;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.DbModels;
using Json.Schema.Generation;
using Json.Schema.Generation.Intents;
using System.Collections.Concurrent;
using DescriptionAttribute = Json.Schema.Generation.DescriptionAttribute;
using Newtonsoft.Json.Linq;

namespace SorobanSecurityPortalApi.Common;

public interface IExtendedConfig
{
    string Proxy { get; }
    int TokenExpirationTimeMinutes { get; }
    int PermanentTokenExpirationTimeDays { get; }
    string AuthIssuer { get; }
    string AuthAudience { get; }
    string AuthSecurityKey { get; }
    string GoogleClientId { get; }
    string GoogleClientSecret { get; }
    string DiscordClientId { get; }
    string DiscordClientSecret { get; }
    bool AllowBasicAuth { get; }
    string GeminiEmbeddingModel { get; }
    string GeminiApiKey { get; }
    string GeminiGenerativeModel { get; }
    double TrigramNameWeight { get; }
    double TrigramContentWeight { get; }
    double VectorContentWeight { get; }
    double MinRelevanceForSearch { get; }
    bool ProfanityFilterEnabled { get; }
    List<string> ProfanityWords { get; }
    List<string> TrustedDomains { get; }
    void Reset();
}

public class ExtendedConfig : IExtendedConfig
{
    private DateTime _nextRefresh = DateTime.MinValue;
    private ConcurrentDictionary<string, string> _configValues = new();
    private readonly IServiceScopeFactory _scopeFactory;
    private const int RefreshTimeSec = 15;
    private readonly object _lock = new();

    private readonly string _appSettings = File.ReadAllText("appsettings.json");

    public ExtendedConfig(IServiceScopeFactory scopeFactory)
    {
        _scopeFactory = scopeFactory;
    }


    public void Reset()
    {
        lock (_lock)
        {
            if (DateTime.Now > _nextRefresh)
            {
                using (var scope = _scopeFactory.CreateScope())
                {
                    var settingsProcessor = scope.ServiceProvider.GetRequiredService<ISettingsProcessor>();
                    _configValues = new ConcurrentDictionary<string, string>(settingsProcessor.Get(SettingType.Common));
                }
                _nextRefresh = DateTime.Now.AddSeconds(RefreshTimeSec);
            }
        }
    }

    private T GetValue<T>(string key) => GetValue(key, default(T)!);
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
        return default!;
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

    [Category(CategoryAttribute.ConfigCategoryEnum.Search)]
    [DataType(DataTypeAttribute.ConfigDataTypeEnum.String)]
    [Description("Gemini Generative Model")]
    [Tooltip("The Gemini Generative Model used for AI-powered vulnerability extraction from audit reports. Supports models like 'gemini-2.0-flash', 'gemini-1.5-pro'.")]
    public string GeminiGenerativeModel => GetValue<string>("GeminiGenerativeModel", "gemini-3-flash-preview");

    [Category(CategoryAttribute.ConfigCategoryEnum.Search)]
    [DataType(DataTypeAttribute.ConfigDataTypeEnum.Double)]
    [Description("Name Weight via Trigram Search")]
    [Tooltip("The Name Weight via Trigram Search is used to specify the weight of the name field in the trigram search. This is used to improve search results by giving more weight to the name field when searching for reports and vulnerabilities.")]
    public double TrigramNameWeight => GetValue<double>("TrigramNameWeight", 5);

    [Category(CategoryAttribute.ConfigCategoryEnum.Search)]
    [DataType(DataTypeAttribute.ConfigDataTypeEnum.Double)]
    [Description("Content Weight via Trigram Search")]
    [Tooltip("The Content Weight via Trigram Search is used to specify the weight of the content field in the trigram search. This is used to improve search results by giving more weight to the content field when searching for reports and vulnerabilities.")]
    public double TrigramContentWeight => GetValue<double>("TrigramContentWeight", 3);

    [Category(CategoryAttribute.ConfigCategoryEnum.Search)]
    [DataType(DataTypeAttribute.ConfigDataTypeEnum.Double)]
    [Description("Name Weight via Vector Search")]
    [Tooltip("The Name Weight via Vector Search is used to specify the weight of the name field in the vector search. This is used to improve search results by giving more weight to the name field when searching for reports and vulnerabilities.")]
    public double VectorContentWeight => GetValue<double>("VectorContentWeight", 10);

    [Category(CategoryAttribute.ConfigCategoryEnum.Search)]
    [DataType(DataTypeAttribute.ConfigDataTypeEnum.Double)]
    [Description("Min Relevance for Search")]
    [Tooltip("The Min Relevance for Search is used to specify the minimum relevance score for search results. This is used to filter out low-relevance results from search queries.")]
    public double MinRelevanceForSearch => GetValue<double>("MinRelevanceForSearch", 6);

    [Category(CategoryAttribute.ConfigCategoryEnum.ContentFilter)]
    [DataType(DataTypeAttribute.ConfigDataTypeEnum.Boolean)]
    [Description("Enable Profanity Filter")]
    [Tooltip("Enables the profanity filter for user-generated content. When enabled, content containing profane words will be flagged for moderation.")]
    public bool ProfanityFilterEnabled => GetValue<bool>("ProfanityFilterEnabled", false);

    [Category(CategoryAttribute.ConfigCategoryEnum.ContentFilter)]
    [DataType(DataTypeAttribute.ConfigDataTypeEnum.Multiline)]
    [Description("Custom Profanity Words (one per line)")]
    [Tooltip("Additional words to filter beyond the default dictionary. Enter one word per line. Words are matched case-insensitively. The system will notify you if a word already exists in the default dictionary.")]
    public List<string> ProfanityWords
    {
        get
        {
            var words = GetValue<string>("ProfanityWords", "");
            return string.IsNullOrWhiteSpace(words)
                ? new List<string>()
                : words.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries)
                       .Select(w => w.Trim())
                       .Where(w => !string.IsNullOrWhiteSpace(w))
                       .ToList();
        }
    }

    [Category(CategoryAttribute.ConfigCategoryEnum.ContentFilter)]
    [DataType(DataTypeAttribute.ConfigDataTypeEnum.Link)]
    [Description("View Default Profanity Dictionary")]
    [Tooltip("Click to view the built-in profanity words that are always active. These words cannot be modified, but you can add custom words above.")]
    public string DefaultProfanityWordsLink => "/api/settings/default-profanity-words";

    [Category(CategoryAttribute.ConfigCategoryEnum.ContentFilter)]
    [Description("Trusted Domains")]
    [Tooltip("Comma-separated list of trusted domains for URLs in content (e.g., github.com,stellar.org). If empty, all HTTPS URLs are allowed but flagged for moderation.")]
    public List<string> TrustedDomains
    {
        get
        {
            var domains = GetValue<string>("TrustedDomains", "");
            return string.IsNullOrWhiteSpace(domains)
                ? new List<string>()
                : domains.Split(',', StringSplitOptions.RemoveEmptyEntries).Select(d => d.Trim()).ToList();
        }
    }

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
        Dropdown,
        Multiline
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
        [System.ComponentModel.Description("Content Filter")]
        ContentFilter,
    }
}
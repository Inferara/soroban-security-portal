namespace SorobanSecurityPortalApi.Models.ViewModels
{
    public class ConnectionViewModel
    {
        public int ConnectionId { get; set; } = 0;
        public string Name { get; set; } = string.Empty;
        public ConnectionType Type { get; set; } = ConnectionType.SharePoint;
        public Dictionary<string, string> Content { get; set; } = new();
        public DateTime Created { get; set; } = DateTime.UtcNow;
        public string CreatedBy { get; set; } = string.Empty;
        public bool CanBeDeleted { get; set; } = true;
        public int? WorkspaceId { get; set; }
    }

    public enum ConnectionType
    {
        SharePoint = 1,
        AzureOpenAiLlm = 2,
        AzureOpenAiEmbedding = 3,
        BingApi = 4,
        AzureWhisper = 5,
        DocumentIntelligence = 6,
        ContentSafety = 7,
        StorageAccount = 8,
        PostgreSql = 9,
        SqlServer = 10,
        Redis = 11,
        AzureAiTranslator = 12,
        AzureAiSpeech = 13,
        AzureAiSearch = 14,
        OpenAiLlm = 15,
        OpenAiEmbedding = 16,
        CohereLlm = 17,
        AzureServiceBus = 19,
        RabbitMq = 20,
        AzureOpenAiLlmCarousel = 21,
        DeepSeekLlm = 22,
        StabilityAi = 23,
        AzureLogAnalytics = 24,
        GoogleSearchApi = 25,
        Smtp = 26,
        Imap = 27,
        GraphApi = 28,
        AzDoWiki = 29,
        Qdrant = 30,
        OpenSearch = 31,
        Git = 32,
    }
}
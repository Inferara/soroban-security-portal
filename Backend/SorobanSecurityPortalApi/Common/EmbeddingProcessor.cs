using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using SorobanSecurityPortalApi.Models.DbModels;
using Microsoft.ML.Tokenizers;

namespace SorobanSecurityPortalApi.Common
{
    public class EmbeddingProcessor : IEmbeddingProcessor
    {
        private readonly IHttpClientFactory _httpClientFactory;

        private static readonly Tokenizer Tokenizer = TiktokenTokenizer.CreateForEncoding("o200k_base",
            new Dictionary<string, int> { { "<|im_start|>", 100264 }, { "<|im_end|>", 100265 } });

        public EmbeddingProcessor(IHttpClientFactory httpClientFactory)
        {
            _httpClientFactory = httpClientFactory;
        }

        public async Task<List<Chunk>> GetEmbeddingAsync(ConnectionModel connection, string input)
        {
            var client = _httpClientFactory.CreateClient(HttpClients.RetryClient); // to avoid throttling by rate limits

            var isAzure = connection.Type == ConnectionType.AzureOpenAiEmbedding;
            var apiKey = connection.Content["apiKey"];
            var model = connection.Content["modelName"];
            var maxTokens = Convert.ToInt32(connection.Content["maxTokens"]);

            var text = SplitByMaxTokens(input, maxTokens);
            var result = new List<Chunk>();

            if (isAzure)
            {
                var endpoint = connection.Content["endpoint"].TrimEnd('/');
                var deployment = model;
                var apiVersion = connection.Content.TryGetValue("apiVersion", out var version) ? version : "2024-10-21";
                var url = $"{endpoint}/openai/deployments/{deployment}/embeddings?api-version={apiVersion}";

                client.DefaultRequestHeaders.Add("api-key", apiKey);
                foreach (var chunk in text)
                {
                    var embedding = await PostForEmbedding(client, url, chunk);
                    result.Add(new Chunk
                    {
                        Vector = embedding.ToList(),
                        Text = chunk
                    });
                }
            }
            else
            {
                // OpenAI: 
                var url = "https://api.openai.com/v1/embeddings";
                client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
                foreach (var chunk in text)
                {
                    var embedding = await PostForEmbedding(client, url, chunk, model);
                    result.Add(new Chunk
                    {
                        Vector = embedding.ToList(),
                        Text = chunk
                    });
                }
            }
            return result;
        }

        private static async Task<List<float>> PostForEmbedding(HttpClient client, string url, string input, string? model = null)
        {
            object payload;
            if (model is null)
            {
                payload = new { input = input };
            }
            else
            {
                payload = new { input = input, model = model };
            }

            var json = JsonSerializer.Serialize(payload);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await client.PostAsync(url, content);
            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync();
                throw new Exception($"Embedding request failed: {response.StatusCode} - {error}");
            }

            using var stream = await response.Content.ReadAsStreamAsync();
            using var doc = await JsonDocument.ParseAsync(stream);

            var vector = doc.RootElement
                .GetProperty("data")[0]
                .GetProperty("embedding")
                .EnumerateArray()
                .Select(x => x.GetSingle())
                .ToList();

            return vector;
        }

        public List<string> SplitByMaxTokens(string input, int maxTokens)
        {
            var encodeIds = Tokenizer.EncodeToIds(input);

            if (encodeIds.Count <= maxTokens)
                return new List<string> { input };

            var chunks = new List<string>();
            var currentChunk = new List<int>();

            foreach (var encodeId in encodeIds)
            {
                currentChunk.Add(encodeId);

                if (currentChunk.Count >= maxTokens)
                {
                    chunks.Add(Tokenizer.Decode(currentChunk));
                    currentChunk.Clear();
                }
            }

            if (currentChunk.Count > 0)
            {
                chunks.Add(Tokenizer.Decode(currentChunk));
            }

            return chunks;
        }
    }

    public interface IEmbeddingProcessor
    {
        Task<List<Chunk>> GetEmbeddingAsync(ConnectionModel connection, string input);
    }

    public class Chunk
    {
        public List<float> Vector { get; set; } = new();
        public string Text { get; set; } = string.Empty;
    }
}

using System.Text.Json;
using System.Text;

namespace SorobanSecurityPortalApi.Common;

public class GeminiEmbeddingService : IGeminiEmbeddingService
{
    private readonly ExtendedConfig _extendedConfig;
    private readonly IHttpClientFactory _httpClientFactory;

    public GeminiEmbeddingService(ExtendedConfig extendedConfig, IHttpClientFactory httpClientFactory)
    {
        _extendedConfig = extendedConfig;
        _httpClientFactory = httpClientFactory;
    }

    private HttpClient GetHttpClient() => _httpClientFactory.CreateClient(HttpClients.RetryClient);

    private const int MaxBytesPerChunk = 9000;

    private IEnumerable<string> ChunkText(string text)
    {
        var bytes = Encoding.UTF8.GetBytes(text);
        int pos = 0;
        while (pos < bytes.Length)
        {
            int len = Math.Min(MaxBytesPerChunk, bytes.Length - pos);
            int end = pos + len;

            // avoid splitting UTF-8 character mid-sequence
            while (end < bytes.Length && (bytes[end] & 0xC0) == 0x80)
                end--;

            yield return Encoding.UTF8.GetString(bytes, pos, end - pos);
            pos = end;
        }
    }

    public async Task<float[]> GenerateEmbeddingAsync(string input)
    {
        var payload = new
        {
            model = $"models/{_extendedConfig.GeminiEmbeddingModel}",
            content = new { parts = new[] { new { text = input } } }
        };

        using var request = new HttpRequestMessage(
            HttpMethod.Post,
            $"https://generativelanguage.googleapis.com/v1beta/models/{_extendedConfig.GeminiEmbeddingModel}:embedContent"
        );

        request.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
        request.Headers.Add("x-goog-api-key", _extendedConfig.GeminiApiKey);

        using var response = await GetHttpClient().SendAsync(request);
        response.EnsureSuccessStatusCode();

        using var doc = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
        var emb = doc.RootElement.GetProperty("embedding").GetProperty("values");
        var vector = new float[emb.GetArrayLength()];
        int i = 0;
        foreach (var ele in emb.EnumerateArray())
            vector[i++] = ele.GetSingle();

        return vector;
    }

    public async Task<List<float[]>> GenerateEmbeddingsAsync(string input)
    {
        var chunks = ChunkText(input).ToList();
        var embeddings = new List<float[]>();

        foreach (var chunk in chunks)
        {
            var emb = await GenerateEmbeddingAsync(chunk);
            embeddings.Add(emb);
        }

        return embeddings;
    }

    public async Task<float[]> GenerateEmbeddingForDocumentAsync(string input)
    {
        var embeddings = await GenerateEmbeddingsAsync(input);
        if (embeddings.Count == 0)
            throw new InvalidOperationException("No chunks were created from input.");

        int dim = embeddings[0].Length;
        var avg = new float[dim];

        foreach (var vec in embeddings)
            for (int i = 0; i < dim; i++)
                avg[i] += vec[i];

        for (int i = 0; i < dim; i++)
            avg[i] /= embeddings.Count;

        return avg;
    }
}

public interface IGeminiEmbeddingService
{
    Task<float[]> GenerateEmbeddingAsync(string chunk); // One chunk
    Task<List<float[]>> GenerateEmbeddingsAsync(string input); // All chunks
    Task<float[]> GenerateEmbeddingForDocumentAsync(string input); // Average of all chunks
}

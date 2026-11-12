using Microsoft.Extensions.Caching.Memory;
using Pgvector;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;

namespace SorobanSecurityPortalApi.Services.PublicApi
{
    // The read-only operations behind both public transports. REST controllers and MCP tools
    // are thin adapters over this class, so the two can never return different data.
    public class PublicApiService : IPublicApiService
    {
        public const int DefaultPageSize = 20;
        public const int MaxPageSize = VulnerabilityProcessor.MaxPageSize;
        public const int MaxQueryLength = 500;
        public const int MaxReportFindings = 100;

        private static readonly string[] Severities = { "critical", "high", "medium", "low", "note" };
        private static readonly TimeSpan CatalogCacheTime = TimeSpan.FromMinutes(1);
        private static readonly TimeSpan EmbeddingCacheTime = TimeSpan.FromHours(1);
        private static readonly TimeSpan EmbeddingFailureCacheTime = TimeSpan.FromMinutes(1);
        private static readonly TimeSpan EmbeddingTimeout = TimeSpan.FromSeconds(8);
        private const string EmbeddingDownCacheKey = "public-api:embedding-down";
        // Minimum trigram score for a text-only search (see VulnerabilitySearchModel.MinRelevance).
        private const double KeywordMinRelevance = 0.5;

        private readonly IVulnerabilityProcessor _vulnerabilityProcessor;
        private readonly IReportProcessor _reportProcessor;
        private readonly IPublicApiProcessor _publicProcessor;
        private readonly IGeminiEmbeddingService _embeddingService;
        private readonly IExtendedConfig _extendedConfig;
        private readonly Config _config;
        private readonly IMemoryCache _memoryCache;
        private readonly ILogger<PublicApiService> _logger;

        public PublicApiService(
            IVulnerabilityProcessor vulnerabilityProcessor,
            IReportProcessor reportProcessor,
            IPublicApiProcessor publicProcessor,
            IGeminiEmbeddingService embeddingService,
            IExtendedConfig extendedConfig,
            Config config,
            IMemoryCache memoryCache,
            ILogger<PublicApiService> logger)
        {
            _vulnerabilityProcessor = vulnerabilityProcessor;
            _reportProcessor = reportProcessor;
            _publicProcessor = publicProcessor;
            _embeddingService = embeddingService;
            _extendedConfig = extendedConfig;
            _config = config;
            _memoryCache = memoryCache;
            _logger = logger;
        }

        // Config.AppUrl is "https://<domain>/api/v1"; the public site is that minus "/api/v1".
        private string SiteBase => (_config.AppUrl ?? string.Empty).Replace("/api/v1", string.Empty).TrimEnd('/');

        public async Task<PublicVulnerabilityPage> SearchVulnerabilities(PublicVulnerabilityQuery query)
        {
            var (page, pageSize) = NormalizePaging(query.Page, query.PageSize);
            var text = NormalizeQueryText(query.Query);

            var search = new VulnerabilitySearchModel
            {
                SearchText = text,
                Severities = ParseSeverities(query.Severity),
                Categories = ParseCategories(query.Category),
                Tags = SplitList(query.Tag),
                ProtocolIds = await ResolveIds("protocol", query.Protocol, async () => (await Protocols()).Select(p => (p.Id, p.Name))),
                AuditorIds = await ResolveIds("auditor", query.Auditor, async () => (await Auditors()).Select(a => (a.Id, a.Name))),
                CompanyIds = await ResolveIds("company", query.Company, async () => (await Companies()).Select(c => (c.Id, c.Name))),
                ReportIds = query.ReportId is > 0 ? new List<int> { query.ReportId.Value } : null,
                From = ToUtc(query.From),
                To = ToUtc(query.To),
                Page = page,
                PageSize = pageSize,
                IncludeDescription = false,
            };
            if (query.From != null && query.To != null && query.From > query.To)
                throw new PublicApiValidationException("'from' must not be later than 'to'.");

            var searchMode = "none";
            if (text != null)
            {
                search.Embedding = await EmbedQuery(text);
                searchMode = search.Embedding != null ? "semantic" : "keyword";
                if (search.Embedding == null) search.MinRelevance = KeywordMinRelevance;
            }

            var items = await _vulnerabilityProcessor.Search(search);
            var total = await _vulnerabilityProcessor.SearchTotal(search);
            return new PublicVulnerabilityPage
            {
                Items = items.Select(ToSummary).ToList(),
                Total = total,
                Page = page,
                PageSize = pageSize,
                HasMore = (long)page * pageSize < total,
                SearchMode = searchMode,
            };
        }

        public async Task<PublicVulnerabilityDetail?> GetVulnerability(int id)
        {
            if (id <= 0) throw new PublicApiValidationException("'id' must be a positive integer.");
            var v = await _publicProcessor.GetVulnerability(id);
            if (v == null) return null;
            var detail = new PublicVulnerabilityDetail
            {
                Description = v.Description ?? "",
                SourceUrl = string.IsNullOrWhiteSpace(v.ReportUrl) ? null : v.ReportUrl,
            };
            FillSummary(detail, v);
            return detail;
        }

        public async Task<PublicPage<PublicReportSummary>> SearchReports(PublicReportQuery query)
        {
            var (page, pageSize) = NormalizePaging(query.Page, query.PageSize);
            var text = NormalizeQueryText(query.Query);
            if (query.From != null && query.To != null && query.From > query.To)
                throw new PublicApiValidationException("'from' must not be later than 'to'.");

            var search = new ReportSearchModel
            {
                SearchText = text,
                From = ToUtc(query.From),
                To = ToUtc(query.To),
                ProtocolId = await ResolveSingleId("protocol", query.Protocol, async () => (await Protocols()).Select(p => (p.Id, p.Name))),
                AuditorId = await ResolveSingleId("auditor", query.Auditor, async () => (await Auditors()).Select(a => (a.Id, a.Name))),
                CompanyId = await ResolveSingleId("company", query.Company, async () => (await Companies()).Select(c => (c.Id, c.Name))),
                // Without query text the newest report comes first; with text the processor ranks by relevance.
                SortBy = text == null ? "date" : null,
                SortDirection = "desc",
            };
            if (text != null)
            {
                search.Embedding = await EmbedQuery(text);
                if (search.Embedding == null) search.MinRelevance = KeywordMinRelevance;
            }

            // The report search is not paged in the database (there are a few hundred reports at
            // most and it returns a slim projection), so page the ranked list here.
            var all = await _reportProcessor.Search(search);
            return new PublicPage<PublicReportSummary>
            {
                Items = all.Skip((page - 1) * pageSize).Take(pageSize).Select(ToReportSummary).ToList(),
                Total = all.Count,
                Page = page,
                PageSize = pageSize,
                HasMore = (long)page * pageSize < all.Count,
            };
        }

        public async Task<PublicReportDetail?> GetReport(int id, bool includeContent)
        {
            if (id <= 0) throw new PublicApiValidationException("'id' must be a positive integer.");
            var report = await _publicProcessor.GetReport(id, includeContent);
            if (report == null) return null;

            var findingsSearch = new VulnerabilitySearchModel
            {
                ReportIds = new List<int> { id },
                Page = 1,
                PageSize = MaxReportFindings,
                IncludeDescription = false,
            };
            var findings = await _vulnerabilityProcessor.Search(findingsSearch);
            var total = await _vulnerabilityProcessor.SearchTotal(findingsSearch);

            var summary = ToReportSummary(report);
            return new PublicReportDetail
            {
                Id = summary.Id,
                Name = summary.Name,
                Date = summary.Date,
                Protocol = summary.Protocol,
                Company = summary.Company,
                Auditor = summary.Auditor,
                Url = summary.Url,
                DownloadUrl = summary.DownloadUrl,
                FindingsTotal = total,
                FindingsBySeverity = await _publicProcessor.CountReportFindingsBySeverity(id),
                Findings = findings.Select(ToSummary).ToList(),
                Content = includeContent ? report.MdFile : null,
            };
        }

        public async Task<List<PublicProtocol>> ListProtocols() => await Protocols();

        public async Task<List<PublicEntity>> ListAuditors() => await Auditors();

        public async Task<List<PublicEntity>> ListCompanies() => await Companies();

        // ---- catalog (cached briefly: it is read on every name filter) ----

        private async Task<List<PublicProtocol>> Protocols() =>
            (await _memoryCache.GetOrCreateAsync("public-api:protocols", async entry =>
            {
                entry.AbsoluteExpirationRelativeToNow = CatalogCacheTime;
                var list = await _publicProcessor.ListProtocols();
                foreach (var p in list) p.Url = $"{SiteBase}/protocol/{p.Id}";
                return list;
            }))!;

        private async Task<List<PublicEntity>> Auditors() =>
            (await _memoryCache.GetOrCreateAsync("public-api:auditors", async entry =>
            {
                entry.AbsoluteExpirationRelativeToNow = CatalogCacheTime;
                var list = await _publicProcessor.ListAuditors();
                foreach (var a in list) a.Url = $"{SiteBase}/auditor/{a.Id}";
                return list;
            }))!;

        private async Task<List<PublicEntity>> Companies() =>
            (await _memoryCache.GetOrCreateAsync("public-api:companies", async entry =>
            {
                entry.AbsoluteExpirationRelativeToNow = CatalogCacheTime;
                var list = await _publicProcessor.ListCompanies();
                foreach (var c in list) c.Url = $"{SiteBase}/company/{c.Id}";
                return list;
            }))!;

        // ---- input handling ----

        private static (int Page, int PageSize) NormalizePaging(int? page, int? pageSize)
        {
            var p = page is > 0 ? page.Value : 1;
            var size = pageSize is > 0 ? Math.Min(pageSize.Value, MaxPageSize) : DefaultPageSize;
            return (p, size);
        }

        private static string? NormalizeQueryText(string? text)
        {
            if (string.IsNullOrWhiteSpace(text)) return null;
            text = text.Trim();
            if (text.Length > MaxQueryLength)
                throw new PublicApiValidationException($"'query' must be at most {MaxQueryLength} characters.");
            return text;
        }

        private static DateTime? ToUtc(DateTime? value)
        {
            if (value == null) return null;
            return value.Value.Kind == DateTimeKind.Unspecified
                ? DateTime.SpecifyKind(value.Value, DateTimeKind.Utc)
                : value.Value.ToUniversalTime();
        }

        private static List<string>? SplitList(string? value)
        {
            if (string.IsNullOrWhiteSpace(value)) return null;
            var parts = value.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();
            return parts.Count > 0 ? parts : null;
        }

        // Severity is stored in mixed case ("High" and "high" both exist), and the search filter
        // is a case-sensitive IN, so ask for both spellings.
        private static List<string>? ParseSeverities(string? value)
        {
            var parts = SplitList(value);
            if (parts == null) return null;
            var result = new List<string>();
            foreach (var part in parts)
            {
                var lower = part.ToLowerInvariant();
                if (!Severities.Contains(lower))
                    throw new PublicApiValidationException($"Unknown severity '{part}'. Use one of: {string.Join(", ", Severities)}.");
                result.Add(lower);
                result.Add(char.ToUpperInvariant(lower[0]) + lower[1..]);
            }
            return result;
        }

        private static List<VulnerabilityCategory>? ParseCategories(string? value)
        {
            var parts = SplitList(value);
            if (parts == null) return null;
            var result = new List<VulnerabilityCategory>();
            foreach (var part in parts)
            {
                var normalized = part.Replace("_", "").Replace("-", "").Replace(" ", "");
                if (!Enum.TryParse<VulnerabilityCategory>(normalized, ignoreCase: true, out var category)
                    || !Enum.IsDefined(category)
                    || category == VulnerabilityCategory.Invalid)
                    throw new PublicApiValidationException(
                        $"Unknown category '{part}'. Use one of: Valid, ValidNotFixed, ValidPartiallyFixed, Acknowledged, NA.");
                result.Add(category);
            }
            return result;
        }

        // Accepts an id ("12") or a name ("Blend"). Names match case-insensitively: an exact match
        // wins, otherwise every entity whose name contains the text.
        private static async Task<List<int>?> ResolveIds(string kind, string? value, Func<Task<IEnumerable<(int Id, string Name)>>> load)
        {
            if (string.IsNullOrWhiteSpace(value)) return null;
            value = value.Trim();
            var all = (await load()).ToList();
            if (int.TryParse(value, out var id))
            {
                if (all.All(e => e.Id != id))
                    throw new PublicApiValidationException($"Unknown {kind} id {id}.");
                return new List<int> { id };
            }
            var exact = all.Where(e => string.Equals(e.Name, value, StringComparison.OrdinalIgnoreCase)).Select(e => e.Id).ToList();
            if (exact.Count > 0) return exact;
            var partial = all.Where(e => e.Name.Contains(value, StringComparison.OrdinalIgnoreCase)).Select(e => e.Id).ToList();
            if (partial.Count > 0) return partial;
            throw new PublicApiValidationException($"Unknown {kind} '{value}'. List the available ones first.");
        }

        private static async Task<int?> ResolveSingleId(string kind, string? value, Func<Task<IEnumerable<(int Id, string Name)>>> load)
        {
            var ids = await ResolveIds(kind, value, load);
            if (ids == null) return null;
            if (ids.Count > 1)
                throw new PublicApiValidationException($"'{value}' matches {ids.Count} {kind} entries. Use the exact name or the id.");
            return ids[0];
        }

        // Returns null when embeddings are unavailable (no key configured, provider down). The
        // search then ranks on text similarity alone instead of failing the call.
        private async Task<Vector?> EmbedQuery(string text)
        {
            if (string.IsNullOrWhiteSpace(_extendedConfig.GeminiApiKey)) return null;
            // After a failure, skip the provider for a minute for every query, not just this one.
            if (_memoryCache.TryGetValue(EmbeddingDownCacheKey, out _)) return null;
            var cacheKey = "public-api:embedding:" + text.ToLowerInvariant();
            if (_memoryCache.TryGetValue(cacheKey, out float[]? cached) && cached != null)
                return new Vector(cached);
            try
            {
                // The embedding client retries for minutes when the provider is failing. A caller
                // of the public API should not wait for that: give up after a few seconds and
                // answer with a text-only search.
                var embeddingTask = _embeddingService.GenerateEmbeddingForDocumentAsync(text);
                if (await Task.WhenAny(embeddingTask, Task.Delay(EmbeddingTimeout)) != embeddingTask)
                {
                    // Let the abandoned call finish on its own; just make sure its failure is observed.
                    _ = embeddingTask.ContinueWith(t => _ = t.Exception, TaskContinuationOptions.OnlyOnFaulted);
                    throw new TimeoutException($"No embedding after {EmbeddingTimeout.TotalSeconds:0} seconds.");
                }
                var embedding = await embeddingTask;
                _memoryCache.Set(cacheKey, embedding, EmbeddingCacheTime);
                return new Vector(embedding);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Query embedding failed; falling back to text-only search");
                _memoryCache.Set(EmbeddingDownCacheKey, true, EmbeddingFailureCacheTime);
                return null;
            }
        }

        // ---- mapping ----

        private PublicVulnerabilitySummary ToSummary(VulnerabilityModel v)
        {
            var summary = new PublicVulnerabilitySummary();
            FillSummary(summary, v);
            return summary;
        }

        private void FillSummary(PublicVulnerabilitySummary target, VulnerabilityModel v)
        {
            target.Id = v.Id;
            target.Title = v.Title;
            target.Severity = (v.Severity ?? "").ToLowerInvariant();
            target.Category = v.Category.ToString();
            target.Tags = v.Tags ?? new List<string>();
            target.Date = v.Date;
            target.Url = $"{SiteBase}/vulnerability/{v.Id}";
            if (v.Report != null)
            {
                target.Report = new PublicRef { Id = v.Report.Id, Name = v.Report.Name };
                if (v.Report.Protocol != null)
                {
                    target.Protocol = new PublicRef { Id = v.Report.Protocol.Id, Name = v.Report.Protocol.Name };
                    if (v.Report.Protocol.Company != null)
                        target.Company = new PublicRef { Id = v.Report.Protocol.Company.Id, Name = v.Report.Protocol.Company.Name };
                }
                if (v.Report.Auditor != null)
                    target.Auditor = new PublicRef { Id = v.Report.Auditor.Id, Name = v.Report.Auditor.Name };
            }
        }

        private PublicReportSummary ToReportSummary(ReportModel r) => new()
        {
            Id = r.Id,
            Name = r.Name,
            Date = r.Date,
            Protocol = r.Protocol == null ? null : new PublicRef { Id = r.Protocol.Id, Name = r.Protocol.Name },
            Company = r.Protocol?.Company == null ? null : new PublicRef { Id = r.Protocol.Company.Id, Name = r.Protocol.Company.Name },
            Auditor = r.Auditor == null ? null : new PublicRef { Id = r.Auditor.Id, Name = r.Auditor.Name },
            Url = $"{SiteBase}/report/{r.Id}",
            DownloadUrl = $"{_config.AppUrl}/reports/{r.Id}/download",
        };
    }

    public interface IPublicApiService
    {
        Task<PublicVulnerabilityPage> SearchVulnerabilities(PublicVulnerabilityQuery query);
        Task<PublicVulnerabilityDetail?> GetVulnerability(int id);
        Task<PublicPage<PublicReportSummary>> SearchReports(PublicReportQuery query);
        Task<PublicReportDetail?> GetReport(int id, bool includeContent);
        Task<List<PublicProtocol>> ListProtocols();
        Task<List<PublicEntity>> ListAuditors();
        Task<List<PublicEntity>> ListCompanies();
    }
}

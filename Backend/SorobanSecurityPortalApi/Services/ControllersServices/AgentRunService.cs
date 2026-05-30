using System.Net.Http;
using System.Text.Json;
using System.Text.Json.Serialization;
using AutoMapper;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Common.Extensions;
using SorobanSecurityPortalApi.Common.Security;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;

namespace SorobanSecurityPortalApi.Services.ControllersServices
{
    public class AgentRunService : IAgentRunService
    {
        // Default model recorded on a run when the caller doesn't specify one (matches the worker's OPENCODE_MODEL).
        private const string DefaultModel = "zai-coding-plan/glm-5.1";

        private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web)
        {
            Converters = { new JsonStringEnumConverter() }
        };

        private const long MaxPdfSizeBytes = 50L * 1024 * 1024;

        private readonly IMapper _mapper;
        private readonly IAgentRunProcessor _runProcessor;
        private readonly IReportProcessor _reportProcessor;
        private readonly IVulnerabilityProcessor _vulnerabilityProcessor;
        private readonly IProtocolProcessor _protocolProcessor;
        private readonly IAuditorProcessor _auditorProcessor;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IUserContextAccessor _userContextAccessor;

        public AgentRunService(
            IMapper mapper,
            IAgentRunProcessor runProcessor,
            IReportProcessor reportProcessor,
            IVulnerabilityProcessor vulnerabilityProcessor,
            IProtocolProcessor protocolProcessor,
            IAuditorProcessor auditorProcessor,
            IHttpClientFactory httpClientFactory,
            IUserContextAccessor userContextAccessor)
        {
            _mapper = mapper;
            _runProcessor = runProcessor;
            _reportProcessor = reportProcessor;
            _vulnerabilityProcessor = vulnerabilityProcessor;
            _protocolProcessor = protocolProcessor;
            _auditorProcessor = auditorProcessor;
            _httpClientFactory = httpClientFactory;
            _userContextAccessor = userContextAccessor;
        }

        public async Task<Result<AgentRunViewModel, string>> Enqueue(EnqueueAgentRunViewModel request)
        {
            if (string.IsNullOrWhiteSpace(request.SourceUrl) && request.ReportId == null)
                return new Result<AgentRunViewModel, string>.Err("Provide either a source URL or a report id.");

            var loginId = await _userContextAccessor.GetLoginIdAsync();
            var run = await _runProcessor.Add(new AgentRunModel
            {
                SourceUrl = request.SourceUrl ?? "",
                ReportId = request.ReportId,
                Model = string.IsNullOrWhiteSpace(request.Model) ? DefaultModel : request.Model,
                CreatedBy = loginId,
            });
            return new Result<AgentRunViewModel, string>.Ok(ToViewModel(run));
        }

        public async Task<AgentRunListResultViewModel> List(int page, int pageSize)
        {
            var items = await _runProcessor.GetList(page, pageSize);
            return new AgentRunListResultViewModel
            {
                Items = items.Select(_mapper.Map<AgentRunListItemViewModel>).ToList(),
                Total = await _runProcessor.GetListTotal(),
            };
        }

        public async Task<AgentRunViewModel?> Get(int id)
        {
            var run = await _runProcessor.Get(id);
            return run == null ? null : ToViewModel(run);
        }

        public async Task<Result<AgentRunViewModel, string>> Rerun(int id)
        {
            var existing = await _runProcessor.Get(id);
            if (existing == null)
                return new Result<AgentRunViewModel, string>.Err($"Agent run {id} not found.");
            var loginId = await _userContextAccessor.GetLoginIdAsync();
            var run = await _runProcessor.Add(new AgentRunModel
            {
                SourceUrl = existing.SourceUrl,
                ReportId = existing.ReportId,
                Model = existing.Model,
                CreatedBy = loginId,
            });
            return new Result<AgentRunViewModel, string>.Ok(ToViewModel(run));
        }

        public async Task<Result<bool, string>> Approve(int id, ApproveAgentRunViewModel payload)
        {
            var run = await _runProcessor.Get(id);
            if (run == null)
                return new Result<bool, string>.Err($"Agent run {id} not found.");
            if (run.Status != AgentRunStatus.Succeeded)
                return new Result<bool, string>.Err("Only a succeeded run can be approved.");

            var loginId = await _userContextAccessor.GetLoginIdAsync();

            int reportId;
            if (run.ReportId.HasValue)
            {
                reportId = run.ReportId.Value;
            }
            else
            {
                var auditorId = await ResolveAuditorId(payload.AuditorName, loginId);
                var protocolId = await ResolveProtocolId(payload.ProtocolName, loginId);
                var name = !string.IsNullOrWhiteSpace(payload.ReportTitle) ? payload.ReportTitle
                    : (!string.IsNullOrWhiteSpace(run.SourceUrl) ? run.SourceUrl : $"Agent run {run.Id}");
                var pdf = await TryFetchReportPdf(payload.ReportPdfUrl);
                var report = await _reportProcessor.Add(new ReportModel
                {
                    Name = name,
                    // report.Date is a timestamptz column → Npgsql only accepts UTC-kind. The approve
                    // payload's date comes from a date-only input (Kind=Unspecified) → coerce to UTC.
                    Date = ToUtc(payload.ReportDate) ?? DateTime.UtcNow,
                    Status = ReportModelStatus.New,
                    MdFile = payload.ArticleMarkdown,
                    BinFile = pdf,
                    ProtocolId = protocolId,
                    AuditorId = auditorId,
                    CreatedBy = loginId,
                });
                reportId = report.Id;
            }

            var createdVulnIds = new List<int>();
            foreach (var f in payload.Findings)
            {
                var vuln = await _vulnerabilityProcessor.Add(new VulnerabilityModel
                {
                    Title = f.Title,
                    Description = f.Description,
                    Severity = f.Severity,
                    Tags = f.Tags,
                    Category = f.Category,
                    ReportId = reportId,
                    Date = DateTime.UtcNow,
                    Status = VulnerabilityModelStatus.New,
                    CreatedBy = loginId,
                });
                createdVulnIds.Add(vuln.Id);
            }

            // v1: no DB transaction wraps report+vuln creation and the status flip. If this throws
            // mid-way the run stays Succeeded and can be re-approved (which would duplicate rows).
            // Acceptable for an admin-triggered, human-reviewed flow; revisit if it becomes a problem.
            await _runProcessor.SetProvenance(id, reportId, createdVulnIds);
            await _runProcessor.SetStatus(id, AgentRunStatus.Approved);
            return new Result<bool, string>.Ok(true);
        }

        private static DateTime? ToUtc(DateTime? d)
            => d.HasValue
                ? (d.Value.Kind == DateTimeKind.Unspecified ? DateTime.SpecifyKind(d.Value, DateTimeKind.Utc) : d.Value.ToUniversalTime())
                : null;

        private async Task<byte[]?> TryFetchReportPdf(string? url)
        {
            if (string.IsNullOrWhiteSpace(url)) return null;
            if (!UrlValidator.IsUrlSafeForFetch(url, out _)) return null;
            try
            {
                var http = _httpClientFactory.CreateClient(HttpClients.ReportFetchClient);
                using var resp = await http.GetAsync(url, HttpCompletionOption.ResponseHeadersRead);
                if (!resp.IsSuccessStatusCode) return null;
                if (resp.Content.Headers.ContentLength is > MaxPdfSizeBytes) return null;
                await using var stream = await resp.Content.ReadAsStreamAsync();
                using var ms = new MemoryStream();
                var buffer = new byte[8192];
                long total = 0; int read;
                while ((read = await stream.ReadAsync(buffer)) > 0)
                {
                    total += read;
                    if (total > MaxPdfSizeBytes) return null;
                    await ms.WriteAsync(buffer.AsMemory(0, read));
                }
                var bytes = ms.ToArray();
                return bytes.IsPdf() ? bytes : null;
            }
            catch { return null; } // never fail approve on a bad PDF url
        }

        private async Task<int?> ResolveAuditorId(string? name, int loginId)
        {
            if (string.IsNullOrWhiteSpace(name)) return null;
            var trimmed = name.Trim();
            var all = await _auditorProcessor.List() ?? new List<AuditorModel>();
            var existing = all.FirstOrDefault(a => string.Equals(a.Name?.Trim(), trimmed, StringComparison.OrdinalIgnoreCase));
            if (existing != null) return existing.Id;
            var created = await _auditorProcessor.Add(new AuditorModel { Name = trimmed, Date = DateTime.UtcNow, CreatedBy = loginId });
            return created.Id;
        }

        private async Task<int?> ResolveProtocolId(string? name, int loginId)
        {
            if (string.IsNullOrWhiteSpace(name)) return null;
            var trimmed = name.Trim();
            var all = await _protocolProcessor.List() ?? new List<ProtocolModel>();
            var existing = all.FirstOrDefault(p => string.Equals(p.Name?.Trim(), trimmed, StringComparison.OrdinalIgnoreCase));
            if (existing != null) return existing.Id;
            var created = await _protocolProcessor.Add(new ProtocolModel { Name = trimmed, Date = DateTime.UtcNow, CreatedBy = loginId });
            return created.Id;
        }

        public async Task<Result<bool, string>> Reject(int id)
        {
            var run = await _runProcessor.Get(id);
            if (run == null)
                return new Result<bool, string>.Err($"Agent run {id} not found.");
            if (run.Status != AgentRunStatus.Succeeded && run.Status != AgentRunStatus.Failed)
                return new Result<bool, string>.Err("Only a succeeded or failed run can be rejected.");
            await _runProcessor.SetStatus(id, AgentRunStatus.Rejected);
            return new Result<bool, string>.Ok(true);
        }

        public async Task<AgentExamplesViewModel> GetExamples()
        {
            var reports = await _reportProcessor.GetListForExamples();
            var vulns = await _vulnerabilityProcessor.GetList();
            var approvedReports = reports
                .Where(r => r.Status == ReportModelStatus.Approved && !string.IsNullOrWhiteSpace(r.MdFile))
                .OrderByDescending(r => r.Id).Take(6)
                .Select(r => new AgentExampleArticle { Title = r.Name, Markdown = r.MdFile }).ToList();
            var approvedVulns = vulns.Where(v => v.Status == VulnerabilityModelStatus.Approved).ToList();
            return new AgentExamplesViewModel
            {
                Articles = approvedReports,
                Vulnerabilities = approvedVulns.OrderByDescending(v => v.Id).Take(12)
                    .Select(v => new AgentExampleVulnerability {
                        Title = v.Title, Severity = v.Severity, Category = (int)v.Category,
                        Tags = v.Tags ?? new List<string>(), Description = v.Description }).ToList(),
                ExistingFindingTitles = approvedVulns.Select(v => v.Title).Where(t => !string.IsNullOrWhiteSpace(t)).Distinct().ToList(),
            };
        }

        public async Task<Result<bool, string>> UpdateProgress(int id, string? transcript)
        {
            var run = await _runProcessor.Get(id);
            if (run == null) return new Result<bool, string>.Err($"Agent run {id} not found.");
            await _runProcessor.UpdateTranscript(id, transcript ?? "");
            return new Result<bool, string>.Ok(true);
        }

        public async Task<AgentRunViewModel?> ClaimNext()
        {
            var run = await _runProcessor.ClaimNextQueued();
            return run == null ? null : ToViewModel(run);
        }

        public async Task<Result<bool, string>> SubmitResult(int id, SubmitAgentRunResultViewModel result)
        {
            var run = await _runProcessor.Get(id);
            if (run == null)
                return new Result<bool, string>.Err($"Agent run {id} not found.");
            await _runProcessor.SubmitResult(id, new AgentRunResult
            {
                Success = result.Success,
                ArticleMarkdown = result.ArticleMarkdown,
                FindingsJson = result.FindingsJson,
                Transcript = result.Transcript,
                TokensUsed = result.TokensUsed,
                DurationMs = result.DurationMs,
                Error = result.Error,
                ReportTitle = result.ReportTitle,
                ProtocolName = result.ProtocolName,
                AuditorName = result.AuditorName,
                ReportDate = result.ReportDate,
                ReportPdfUrl = result.ReportPdfUrl,
            });
            return new Result<bool, string>.Ok(true);
        }

        private AgentRunViewModel ToViewModel(AgentRunModel run)
        {
            var vm = _mapper.Map<AgentRunViewModel>(run);
            var (findings, parsedOk) = ParseFindingsWithStatus(run.FindingsJson);
            vm.Findings = findings;
            vm.FindingsUnparseable = !string.IsNullOrWhiteSpace(run.FindingsJson) && !parsedOk;
            return vm;
        }

        internal static List<AgentFinding> ParseFindings(string? findingsJson)
            => ParseFindingsWithStatus(findingsJson).findings;

        internal static (List<AgentFinding> findings, bool parsedOk) ParseFindingsWithStatus(string? findingsJson)
        {
            if (string.IsNullOrWhiteSpace(findingsJson)) return (new List<AgentFinding>(), true);
            try
            {
                return (JsonSerializer.Deserialize<List<AgentFinding>>(findingsJson, JsonOpts)
                    ?? new List<AgentFinding>(), true);
            }
            catch (JsonException)
            {
                return (new List<AgentFinding>(), false);
            }
        }
    }

    public interface IAgentRunService
    {
        Task<Result<AgentRunViewModel, string>> Enqueue(EnqueueAgentRunViewModel request);
        Task<AgentRunListResultViewModel> List(int page, int pageSize);
        Task<AgentRunViewModel?> Get(int id);
        Task<Result<AgentRunViewModel, string>> Rerun(int id);
        Task<Result<bool, string>> Approve(int id, ApproveAgentRunViewModel payload);
        Task<Result<bool, string>> Reject(int id);
        Task<AgentRunViewModel?> ClaimNext();
        Task<Result<bool, string>> SubmitResult(int id, SubmitAgentRunResultViewModel result);
        Task<AgentExamplesViewModel> GetExamples();
        Task<Result<bool, string>> UpdateProgress(int id, string? transcript);
    }
}

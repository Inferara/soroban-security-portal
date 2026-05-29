using System.Text.Json;
using AutoMapper;
using SorobanSecurityPortalApi.Common;
using SorobanSecurityPortalApi.Data.Processors;
using SorobanSecurityPortalApi.Models.DbModels;
using SorobanSecurityPortalApi.Models.ViewModels;

namespace SorobanSecurityPortalApi.Services.ControllersServices
{
    public class AgentRunService : IAgentRunService
    {
        private static readonly JsonSerializerOptions JsonOpts =
            new(JsonSerializerDefaults.Web);

        private readonly IMapper _mapper;
        private readonly IAgentRunProcessor _runProcessor;
        private readonly IReportProcessor _reportProcessor;
        private readonly IVulnerabilityProcessor _vulnerabilityProcessor;
        private readonly IUserContextAccessor _userContextAccessor;

        public AgentRunService(
            IMapper mapper,
            IAgentRunProcessor runProcessor,
            IReportProcessor reportProcessor,
            IVulnerabilityProcessor vulnerabilityProcessor,
            IUserContextAccessor userContextAccessor)
        {
            _mapper = mapper;
            _runProcessor = runProcessor;
            _reportProcessor = reportProcessor;
            _vulnerabilityProcessor = vulnerabilityProcessor;
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
                Model = request.Model ?? "",
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

        public Task<Result<bool, string>> Approve(int id) => throw new NotImplementedException();
        public Task<Result<bool, string>> Reject(int id) => throw new NotImplementedException();

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
            });
            return new Result<bool, string>.Ok(true);
        }

        private AgentRunViewModel ToViewModel(AgentRunModel run)
        {
            var vm = _mapper.Map<AgentRunViewModel>(run);
            vm.Findings = ParseFindings(run.FindingsJson);
            return vm;
        }

        internal static List<AgentFinding> ParseFindings(string? findingsJson)
        {
            if (string.IsNullOrWhiteSpace(findingsJson)) return new List<AgentFinding>();
            try
            {
                return JsonSerializer.Deserialize<List<AgentFinding>>(findingsJson, JsonOpts)
                    ?? new List<AgentFinding>();
            }
            catch (JsonException)
            {
                return new List<AgentFinding>();
            }
        }
    }

    public interface IAgentRunService
    {
        Task<Result<AgentRunViewModel, string>> Enqueue(EnqueueAgentRunViewModel request);
        Task<AgentRunListResultViewModel> List(int page, int pageSize);
        Task<AgentRunViewModel?> Get(int id);
        Task<Result<AgentRunViewModel, string>> Rerun(int id);
        Task<Result<bool, string>> Approve(int id);
        Task<Result<bool, string>> Reject(int id);
        Task<AgentRunViewModel?> ClaimNext();
        Task<Result<bool, string>> SubmitResult(int id, SubmitAgentRunResultViewModel result);
    }
}

using Microsoft.EntityFrameworkCore;
using SorobanSecurityPortalApi.Common.Data;
using SorobanSecurityPortalApi.Models.DbModels;

namespace SorobanSecurityPortalApi.Data.Processors
{
    public class AgentRunProcessor : IAgentRunProcessor
    {
        private readonly IDbContextFactory<Db> _dbFactory;

        public AgentRunProcessor(IDbContextFactory<Db> dbFactory)
        {
            _dbFactory = dbFactory;
        }

        public async Task<AgentRunModel> Add(AgentRunModel model)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            model.Status = AgentRunStatus.Queued;
            model.CreatedAt = DateTime.UtcNow;
            db.AgentRun.Add(model);
            await db.SaveChangesAsync();
            return model;
        }

        public async Task<AgentRunModel?> Get(int id)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            return await db.AgentRun.AsNoTracking().FirstOrDefaultAsync(r => r.Id == id);
        }

        // List projection deliberately omits the heavy text columns (ArticleMarkdown,
        // FindingsJson, Transcript) — the list never needs them.
        public async Task<List<AgentRunModel>> GetList(int page, int pageSize)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var p = page > 0 ? page : 1;
            var ps = pageSize > 0 ? pageSize : 20;
            return await db.AgentRun
                .AsNoTracking()
                .OrderByDescending(r => r.Id)
                .Skip((p - 1) * ps)
                .Take(ps)
                .Select(r => new AgentRunModel
                {
                    Id = r.Id, Status = r.Status, SourceUrl = r.SourceUrl, ReportId = r.ReportId,
                    Model = r.Model, PromptVersion = r.PromptVersion, Error = r.Error,
                    TokensUsed = r.TokensUsed, DurationMs = r.DurationMs, CreatedBy = r.CreatedBy,
                    CreatedAt = r.CreatedAt, StartedAt = r.StartedAt, FinishedAt = r.FinishedAt,
                    CreatedReportId = r.CreatedReportId
                })
                .ToListAsync();
        }

        public async Task<int> GetListTotal()
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            return await db.AgentRun.AsNoTracking().CountAsync();
        }

        public async Task<AgentRunModel?> ClaimNextQueued()
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            // Single-worker design: read-then-update without a row lock is safe because only one worker claims jobs. If a second worker is ever added, switch to SELECT ... FOR UPDATE SKIP LOCKED.
            var next = await db.AgentRun
                .Where(r => r.Status == AgentRunStatus.Queued)
                .OrderBy(r => r.Id)
                .FirstOrDefaultAsync();
            if (next == null) return null;
            next.Status = AgentRunStatus.Processing;
            next.StartedAt = DateTime.UtcNow;
            db.AgentRun.Update(next);
            await db.SaveChangesAsync();
            return next;
        }

        public async Task SubmitResult(int id, AgentRunResult result)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var run = await db.AgentRun.FirstAsync(r => r.Id == id);
            run.Status = result.Success ? AgentRunStatus.Succeeded : AgentRunStatus.Failed;
            run.ArticleMarkdown = result.ArticleMarkdown ?? "";
            run.FindingsJson = result.FindingsJson ?? "";
            run.Transcript = result.Transcript ?? "";
            run.Error = result.Error ?? "";
            run.TokensUsed = result.TokensUsed;
            run.DurationMs = result.DurationMs;
            run.FinishedAt = DateTime.UtcNow;
            db.AgentRun.Update(run);
            await db.SaveChangesAsync();
        }

        public async Task SetStatus(int id, string status)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var run = await db.AgentRun.FirstAsync(r => r.Id == id);
            run.Status = status;
            db.AgentRun.Update(run);
            await db.SaveChangesAsync();
        }

        public async Task SetProvenance(int id, int createdReportId, List<int> createdVulnerabilityIds)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var run = await db.AgentRun.FirstAsync(r => r.Id == id);
            run.CreatedReportId = createdReportId;
            run.CreatedVulnerabilityIds = createdVulnerabilityIds;
            db.AgentRun.Update(run);
            await db.SaveChangesAsync();
        }
    }

    public interface IAgentRunProcessor
    {
        Task<AgentRunModel> Add(AgentRunModel model);
        Task<AgentRunModel?> Get(int id);
        Task<List<AgentRunModel>> GetList(int page, int pageSize);
        Task<int> GetListTotal();
        Task<AgentRunModel?> ClaimNextQueued();
        Task SubmitResult(int id, AgentRunResult result);
        Task SetStatus(int id, string status);
        Task SetProvenance(int id, int createdReportId, List<int> createdVulnerabilityIds);
    }
}

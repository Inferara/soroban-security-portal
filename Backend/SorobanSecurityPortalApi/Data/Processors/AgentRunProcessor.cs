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
            var run = await db.AgentRun.FirstOrDefaultAsync(r => r.Id == id);
            // Only a run we believe is still running may be finalized. A late/duplicate submit from a
            // worker whose run was already reaped (Failed), or a second delivery of the same result,
            // must NOT clobber a terminal run (succeeded/failed/approved/rejected). Ignore it.
            if (run == null || run.Status != AgentRunStatus.Processing)
                return;
            run.Status = result.Success ? AgentRunStatus.Succeeded : AgentRunStatus.Failed;
            run.ArticleMarkdown = result.ArticleMarkdown ?? "";
            run.FindingsJson = result.FindingsJson ?? "";
            run.Transcript = result.Transcript ?? "";
            run.Error = result.Error ?? "";
            run.TokensUsed = result.TokensUsed;
            run.DurationMs = result.DurationMs;
            run.ReportTitle = result.ReportTitle ?? "";
            run.ProtocolName = result.ProtocolName ?? "";
            run.AuditorName = result.AuditorName ?? "";
            // report_date is a `timestamp with time zone` column → Npgsql only accepts UTC-kind
            // DateTimes. An incoming date (e.g. "2026-04-13" with Kind=Unspecified) would otherwise
            // throw on save. Normalize any kind to UTC before storing.
            run.ReportDate = result.ReportDate.HasValue
                ? (result.ReportDate.Value.Kind == DateTimeKind.Unspecified
                    ? DateTime.SpecifyKind(result.ReportDate.Value, DateTimeKind.Utc)
                    : result.ReportDate.Value.ToUniversalTime())
                : null;
            run.ReportPdfUrl = result.ReportPdfUrl ?? "";
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

        public async Task UpdateTranscript(int id, string transcript)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var run = await db.AgentRun.FirstAsync(r => r.Id == id);
            run.Transcript = transcript;
            db.AgentRun.Update(run);
            await db.SaveChangesAsync();
        }

        // Fails runs that have been Processing longer than `olderThan` — i.e. a worker claimed the job
        // then died (OOM/deploy/node-drain) without ever submitting. Without this they stay Processing
        // forever and are never retried. Returns how many were reclaimed.
        public async Task<int> ReclaimStuckProcessing(TimeSpan olderThan)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var cutoff = DateTime.UtcNow - olderThan;
            var stuck = await db.AgentRun
                .Where(r => r.Status == AgentRunStatus.Processing
                    && r.StartedAt != null && r.StartedAt < cutoff)
                .ToListAsync();
            foreach (var run in stuck)
            {
                run.Status = AgentRunStatus.Failed;
                run.Error = "Abandoned: no worker result within the processing timeout (worker likely died).";
                run.FinishedAt = DateTime.UtcNow;
                db.AgentRun.Update(run);
            }
            if (stuck.Count > 0)
                await db.SaveChangesAsync();
            return stuck.Count;
        }

        // Dedup helper: is this source URL already represented by a run that is queued, processing, or
        // already approved into a report? (Failed/Rejected/bare-Succeeded don't count — those can be
        // retried.) Returns the most recent such run, or null.
        public async Task<AgentRunModel?> FindActiveOrApprovedBySourceUrl(string sourceUrl)
        {
            if (string.IsNullOrWhiteSpace(sourceUrl)) return null;
            await using var db = await _dbFactory.CreateDbContextAsync();
            return await db.AgentRun.AsNoTracking()
                .Where(r => r.SourceUrl == sourceUrl
                    && (r.Status == AgentRunStatus.Queued
                        || r.Status == AgentRunStatus.Processing
                        || r.Status == AgentRunStatus.Approved))
                .OrderByDescending(r => r.Id)
                .FirstOrDefaultAsync();
        }

        // Commits an approval atomically: claims the Succeeded→Approved transition with a conditional
        // UPDATE (so concurrent/duplicate approvals can't both win), then creates the report and
        // vulnerabilities and records provenance — all in ONE transaction. If anything throws, the whole
        // thing rolls back (status reverts to Succeeded) so a retry can't leave duplicate rows. Returns
        // null if the run was no longer Succeeded (already approved by someone else).
        public async Task<ApprovalCommitResult?> CommitApproval(
            int runId, ReportModel? newReport, int? existingReportId, List<VulnerabilityModel> vulnerabilities)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            await using var tx = await db.Database.BeginTransactionAsync();

            // Atomic claim: only the caller that flips Succeeded→Approved proceeds.
            var claimed = await db.Database.ExecuteSqlRawAsync(
                "UPDATE agent_run SET status = {0} WHERE id = {1} AND status = {2}",
                AgentRunStatus.Approved, runId, AgentRunStatus.Succeeded);
            if (claimed == 0)
            {
                await tx.RollbackAsync();
                return null;
            }

            int reportId;
            if (newReport != null)
            {
                db.Report.Add(newReport);
                await db.SaveChangesAsync();
                reportId = newReport.Id;
            }
            else
            {
                reportId = existingReportId!.Value;
            }

            foreach (var v in vulnerabilities)
                v.ReportId = reportId;
            db.Vulnerability.AddRange(vulnerabilities);
            await db.SaveChangesAsync();
            var vulnIds = vulnerabilities.Select(v => v.Id).ToList();

            // The raw UPDATE above isn't tracked by this context — load the run fresh to write provenance.
            var run = await db.AgentRun.FirstAsync(r => r.Id == runId);
            run.CreatedReportId = reportId;
            run.CreatedVulnerabilityIds = vulnIds;
            db.AgentRun.Update(run);
            await db.SaveChangesAsync();

            await tx.CommitAsync();
            return new ApprovalCommitResult { ReportId = reportId, VulnerabilityIds = vulnIds };
        }
    }

    public sealed class ApprovalCommitResult
    {
        public int ReportId { get; set; }
        public List<int> VulnerabilityIds { get; set; } = new();
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
        Task UpdateTranscript(int id, string transcript);
        Task<int> ReclaimStuckProcessing(TimeSpan olderThan);
        Task<AgentRunModel?> FindActiveOrApprovedBySourceUrl(string sourceUrl);
        Task<ApprovalCommitResult?> CommitApproval(int runId, ReportModel? newReport, int? existingReportId, List<VulnerabilityModel> vulnerabilities);
    }
}

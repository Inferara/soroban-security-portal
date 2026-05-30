# Agent Ingestion — Capture the original report PDF (Plan 5)

> Subagent-driven, TDD, worktree `worktree-agent-audit-ingestion`.

**Problem:** portal Reports are PDF-centric (`report.BinFile` = the downloadable PDF; `MdFile` = content). Agent-ingested reports had no PDF. But report pages (e.g. hacken.io) usually expose a direct PDF "Download" link. The agent must discover it; on approve the backend downloads it into `BinFile`.

**Safe interaction:** `ReportProcessor.GetListForFix()` only fixes reports with EMPTY `MdFile`. We set `MdFile = generated article` (non-empty) → the PDF→markdown background job SKIPS it → our article is preserved while `BinFile` holds the real PDF (download works).

**Contract addition:** the agent's `result.json` gains `reportPdfUrl` — the direct download URL of the original report document (PDF). If the source URL is itself a PDF, `reportPdfUrl` = the source URL. Empty if none found (→ article-only report, no BinFile).

---

## Task 1 (backend): store reportPdfUrl + download PDF on approve
**Files:** `AgentRunModel.cs` (+migration), `AgentRunViewModels.cs`, `AgentRunProcessor.cs`, `AgentRunService.cs`, controller unchanged, tests.
- `AgentRunModel`: add `string ReportPdfUrl = ""`. `AgentRunResult` + `SubmitAgentRunResultViewModel`: add `string? ReportPdfUrl`. `AgentRunProcessor.SubmitResult`: `run.ReportPdfUrl = result.ReportPdfUrl ?? ""`. `AgentRunViewModel`: add `string ReportPdfUrl = ""` (AutoMapper maps). EF migration `AddAgentRunReportPdfUrl`.
- `ApproveAgentRunViewModel`: add `string ReportPdfUrl = ""` (moderator-editable, pre-filled from the run).
- `AgentRunService`: inject `IHttpClientFactory` + (already has processors). New private `async Task<byte[]?> TryFetchPdf(string? url)`: if blank → null; if `!UrlValidator.IsUrlSafeForFetch(url, out _)` → null; GET via `_httpClientFactory.CreateClient(HttpClients.ReportFetchClient)` with size cap (50MB, stream) ; if bytes `.IsPdf()` → return bytes else null. Swallow exceptions → null (never fail approve on a bad PDF url).
- In `Approve`, when creating a NEW report (the `else` branch): `var pdf = await TryFetchPdf(payload.ReportPdfUrl); report.BinFile = pdf;` (set BinFile when a valid PDF was fetched; MdFile stays = article). Existing-report branch unchanged.
- Tests (mock `IHttpClientFactory` with a fake handler): Approve with a reportPdfUrl that returns valid PDF bytes → report.Add receives BinFile non-null; with a non-PDF / failing url → BinFile null but approve still Ok + report created; SubmitResult stores ReportPdfUrl; Get returns it. (Use a stub `HttpMessageHandler`; `UrlValidator.IsUrlSafeForFetch` must pass for a normal https url — use `https://example.com/r.pdf`.)

**Acceptance:** suite green; approving with a valid PDF url populates BinFile; article (MdFile) preserved; bad url → graceful.

## Task 2 (worker): parse reportPdfUrl + prompt
**Files:** `Api/Dtos.cs` (SubmitResultDto + ReportPdfUrl), `Worker/IngestionRunner.cs` (MapToSubmit reads `reportPdfUrl` from result.json), `Worker/IIngestionPrompt.cs` (prompt: "find the direct download link to the original report document (PDF) on the page — e.g. a 'Download' button/href — and put it in result.json as `reportPdfUrl`; if the source URL is already a PDF, use it; empty string if none"), tests.

## Task 3 (UI): editable Report PDF URL on the review screen
**Files:** `models/agent-run.ts` (AgentRun + ApproveAgentRun gain `reportPdfUrl`), `soroban-security-portal-api.ts` (approve payload), `agent-run-detail.tsx` (a "Report PDF URL" TextField in the metadata section, pre-filled from run.reportPdfUrl; helper text "the agent's discovered link to the original PDF; downloaded into the report on approve"; included in the approve payload), tests.

## Verify
Local suites. Dev: rebuild+push api+ui (new tag), redeploy; via Playwright: a run whose reportPdfUrl is a real public PDF → approve → confirm the created report has BinFile (download works) + still shows our article. (Find the Hacken ROZO PDF direct link, or use any public PDF for the mechanism.)

## Out of scope: storing the source PAGE url on the report (separate `SourceUrl` field) — can add later; PDF (BinFile) is the priority.

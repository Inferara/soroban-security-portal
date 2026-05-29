# Agent Ingestion — Auto-link + Editable Partial Approve (Plan 2.5)

> Execute subagent-driven (superpowers:subagent-driven-development) in the worktree on `worktree-agent-audit-ingestion`. TDD per task.

**Goal:** (1) On approve, auto-resolve-or-create Protocol & Auditor from agent-extracted names and link the report (#8). (2) Make approve operate on the moderator's **edited, selected subset** of findings + edited article/metadata, with an editable review UI (#12).

**Also recorded (no code, for Plan 3):**
- Worker auth: mount `~/.local/share/opencode/auth.json` = `{"zai-coding-plan":{"type":"api","key":"<K8s secret>"}}` (key never committed).
- Worker model: `zai-coding-plan/glm-5.1`.

**Contract change (agent output + worker → backend):** the run now also carries report-level metadata the agent extracts: `ReportTitle`, `ProtocolName`, `AuditorName`, `ReportDate`. The spike prompt is updated to emit these (in `findings.json` we keep the array; metadata travels via the worker's submit call — see Plan 3). For Plan 2.5 the backend stores+exposes them and the UI pre-fills the editable form from them.

---

## Task A (backend): store agent-extracted report metadata on the run

**Files:** `AgentRunModel.cs` (+ migration), `AgentRunViewModels.cs`, `AgentRunModelProfile.cs`, `AgentRunProcessor.cs`, `AgentRunService.cs`, processor+service tests.

- Add to `AgentRunModel`: `ReportTitle (string="")`, `ProtocolName (string="")`, `AuditorName (string="")`, `ReportDate (DateTime?)`. EF migration `AddAgentRunReportMeta` (with `.Designer.cs` + snapshot).
- Add the same 4 fields to `SubmitAgentRunResultViewModel` and `AgentRunResult`; `AgentRunProcessor.SubmitResult` persists them.
- Expose the 4 fields on `AgentRunViewModel` (AutoMapper maps by name — no Ignore needed).
- Tests: SubmitResult stores the 4 fields; Get returns them.

**Acceptance:** suite green; a submitted run round-trips ReportTitle/ProtocolName/AuditorName/ReportDate.

---

## Task B (backend): resolve-or-create Protocol/Auditor + editable partial approve

**Files:** `AgentRunViewModels.cs` (new `ApproveAgentRunViewModel`), `AgentRunService.cs`, `AgentRunsController.cs`, deps (`IProtocolProcessor`, `IAuditorProcessor`), service+controller tests.

New request type:
```csharp
public class ApproveAgentRunViewModel
{
    public string ReportTitle { get; set; } = "";
    public string ProtocolName { get; set; } = "";
    public string AuditorName { get; set; } = "";
    public DateTime? ReportDate { get; set; }
    public string ArticleMarkdown { get; set; } = "";
    public List<AgentFinding> Findings { get; set; } = new(); // the SELECTED + EDITED subset to promote
}
```

`IAgentRunService.Approve` becomes `Task<Result<bool,string>> Approve(int id, ApproveAgentRunViewModel payload)`. New behavior:
1. Get run; Err if null; Err if status != Succeeded.
2. loginId = current user.
3. Resolve **Auditor**: if `payload.AuditorName` non-blank → find in `_auditorProcessor.List()` by `Name` (trim, OrdinalIgnoreCase); if none, `Add(new AuditorModel{ Name=payload.AuditorName.Trim(), Date=UtcNow, CreatedBy=loginId })`. Capture `auditorId` (null if name blank).
4. Resolve **Protocol** similarly via `_protocolProcessor.List()` / `Add(new ProtocolModel{ Name=..., Date=UtcNow, CreatedBy=loginId })` → `protocolId` (CompanyId left null).
5. Report: if `run.ReportId` set → reuse; else create `ReportModel{ Name = payload.ReportTitle (fallback to run.SourceUrl / "Agent run {id}"), Date = payload.ReportDate ?? UtcNow, Status=New, MdFile=payload.ArticleMarkdown, ProtocolId=protocolId, AuditorId=auditorId, CreatedBy=loginId }`.
6. For each finding in `payload.Findings` (the subset): create `VulnerabilityModel` from the finding's edited values, `ReportId`, `Status=New`, `CreatedBy=loginId`. Collect ids.
7. `SetProvenance(id, reportId, ids)`; `SetStatus(id, Approved)`; Ok(true).

Inject `IProtocolProcessor` + `IAuditorProcessor` into `AgentRunService` (convention-DI already registers them).

Controller: `POST /{id}/approve` now takes `[FromBody] ApproveAgentRunViewModel payload`.

Tests (service): auto-creates Auditor+Protocol when names new (verify `Add` called) and links them; reuses existing Auditor/Protocol when name matches (case-insensitive, no `Add`); promotes only `payload.Findings` (subset) with edited values; blank names → ProtocolId/AuditorId null; non-succeeded → Err. Controller: approve with body → Ok / Err mapping; missing run → BadRequest.

**Acceptance:** suite green; approving with a 2-of-8 edited subset + a new auditor name creates 1 report (linked to a newly-created auditor + protocol) + exactly 2 vulns with the edited values.

---

## Task C (frontend): model + approve-with-body API

**Files:** `models/agent-run.ts`, `soroban-security-portal-api.ts`.

- `AgentRun` (+ list item where relevant) gains `reportTitle`, `protocolName`, `auditorName`, `reportDate?`.
- New `ApproveAgentRun` type mirroring `ApproveAgentRunViewModel` (`reportTitle, protocolName, auditorName, reportDate?, articleMarkdown, findings: AgentFinding[]`).
- `approveAgentRunCall(id, payload: ApproveAgentRun)` → `POST api/v1/agent-runs/{id}/approve` with body.
- Update the list hook's `approve` (currently `approve(id)` with no body): the LIST page approve should still work — for list-row approve, send a payload built from the run's stored values (fetch detail or send minimal). DECISION: remove approve from the list row (approve now requires the review/edit screen); list keeps View/Reject/Re-run, and Approve happens only on the detail page. Update list hook + page + tests accordingly.

## Task D (frontend): editable, partial-approve detail page

**Files:** `agent-run-detail.tsx` (+ hook), tests.

- Pre-fill editable state from the run: `reportTitle`, `protocolName`, `auditorName`, `reportDate`, `articleMarkdown`, and a working copy of `findings` each with an `include` flag (default true).
- Editable controls: TextFields for title/protocol/auditor + date; article via a multiline TextField (or `MarkdownEditor` if trivially reusable); per-finding row: include Checkbox, title TextField, severity Select (critical/high/medium/low/note), category Select (Valid=0/ValidNotFixed=1/ValidPartiallyFixed=2/Invalid=3/NA=100), tags TextField (comma-separated), description multiline TextField.
- "Approve selected (N)" button → builds `ApproveAgentRun` from edited meta+article + findings.filter(include) → `approveAgentRunCall(id, payload)` → on success navigate back.
- Keep Reject / Re-run / Back. Keep the read-only transcript Accordion + findingsUnparseable warning.
- Tests: renders editable fields pre-filled; unchecking a finding excludes it from the approve payload; editing a severity is reflected in the payload; Approve calls `approveAgentRunCall` with the edited subset and navigates back.

---

## Out of scope (still later): full Plan 3 worker, registry/CSV, prompt-injection/SSRF hardening, dedup, copyright/attribution policy (tracked in spec Risks).

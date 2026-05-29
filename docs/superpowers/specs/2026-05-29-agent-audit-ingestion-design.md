# Agent-driven audit ingestion (OpenCode) — Design

**Date:** 2026-05-29
**Branch:** `feature/agent-audit-ingestion` (from `origin/main`)
**Status:** Design approved; spec under review

## Background

Roadmap items 11 ("Explore LLM-based audit report parsing") and 12 ("Discuss audit
parsing workflow with Georgy") aim to automatically parse Soroban/Stellar audit
reports into consistent markdown articles and extract their vulnerabilities.

`origin/main` already contains a Gemini-based multi-agent extraction pipeline
(Parser → Extractor → Classifier, `gemini-2.0-flash`) behind
`POST /reports/{id}/extract-vulnerabilities`. In practice its quality is limited by
three things: a weak/fast model, a single lossy `PdfToMarkdownConverter` step (most
real reports are Notion/GitHub/blog pages, not PDFs), and a single-shot prompt with
no iteration.

**Decision:** replace this approach for the ingestion path with an **OpenCode CLI
agent** running a frontier model. The agent reads the report source natively,
iterates and self-checks, and produces a consistent markdown article plus structured
vulnerabilities. We persist the agent's full run (result *and* reasoning trace) for
auditability and show it in the admin UI for human review.

The decisive advantage is the **agentic loop** (fetch the real source, re-read,
self-verify), not raw model IQ alone. Human review remains mandatory — there is an
irreducible tail (scanned/paywalled PDFs, odd sources).

## Scope (v1)

In scope:
- Run an OpenCode agent server-side against a single audit report (URL or uploaded
  report) on a **manual admin trigger**.
- Capture the agent's **complete output**: produced markdown article, structured
  vulnerabilities, and the full transcript / reasoning / tool-calls / raw stdout.
- Persist each run as a first-class `AgentRun` record.
- An admin UI to browse runs and inspect one in detail (rendered article, extracted
  vulnerabilities, collapsible reasoning), with **Approve / Reject / Re-run** actions.
- On **Approve**, promote the result into ordinary `Report` + `Vulnerability` rows in
  the existing `New` (pending-review) status, attributed to a synthetic `agent`
  identity, flowing through the existing moderation queue.

Explicitly out of scope (deferred to later phases):
- CRON / scheduled automatic runs.
- The in-product audit registry table and one-time CSV import from the Airtable export.
- An MCP server (not needed — the worker captures the agent's output directly).
- Deleting the existing Gemini pipeline (left dormant for now).

## Key simplification: no MCP

Because the worker captures the agent's output directly, OpenCode does **not** post
back via MCP. This removes the MCP server, agent auth, and cluster-internal
networking from the design entirely. The worker runs OpenCode headless, reads its
structured result file + transcript, and writes to the DB.

## Architecture

```
Admin UI: "Run agent" on a report/URL   (later: CRON)
        │  POST (enqueue agent run)
        ▼
 [agent_run row: status=queued]
        │
        ▼
 [Worker pod] claims queued run → runs OpenCode CLI headless
        │     • frontier model (key from K8s secret)
        │     • prompt instructs: read source, produce article.md + findings.json
        │     • agent fetches source natively (Notion/GitHub/PDF/blog), iterates
        ▼
 Worker captures: article markdown + findings JSON + full transcript/reasoning + meta
        │
        ▼
 [agent_run updated: status=succeeded/failed, result + transcript persisted]
        │
        ▼
 Admin UI detail card:
   • rendered article + extracted vulnerabilities
   • agent reasoning (collapsible — "what it was thinking")
   • Approve → create Report + Vulnerabilities (status=New, createdBy=agent)
   • Reject · Re-run
```

## Components

### 1. Worker (dedicated pod)
- New container image bundling the OpenCode CLI + a thin .NET (or Node) runner loop.
- Deployed as its own K3S Deployment via the existing Helm chart; frontier-model API
  key supplied as a K8s secret/env var.
- Loop: poll the API's internal claim endpoint for a `queued` agent run (the worker
  never touches the DB directly) → it is marked `processing` → invoke OpenCode headless
  with a fixed prompt and the report source → capture outputs → submit the result back
  via the internal submit endpoint (marks `succeeded`/`failed`, attaches result +
  transcript).
- Failure handling: timeout, bounded retries, capture stderr into the run record.
- The agent is instructed to write two well-defined artifacts (e.g. `article.md` and
  `findings.json` against a fixed schema) so parsing the result is deterministic; the
  raw transcript is captured separately and never parsed, only stored/displayed.

### 2. `AgentRun` entity + persistence
New EF Core entity / `agent_run` table. Fields (initial):
- `Id`, `Status` (queued / processing / succeeded / failed / approved / rejected)
- Input: `SourceUrl` and/or `ReportId` (if run against an existing report), `Prompt`
  version, requested model.
- Output: `ArticleMarkdown` (string), `FindingsJson` (jsonb) — parsed structured
  vulnerabilities.
- Reasoning: `Transcript` (full agent trace / stdout, large text) — stored, never
  parsed.
- Meta: `Model`, `TokensUsed`/cost if available, `DurationMs`, `StartedAt`,
  `FinishedAt`, `Error`, `CreatedBy`, timestamps.
- Link: when approved, references the created `ReportId` and the created
  `VulnerabilityIds` for provenance.
- Processor (`IAgentRunProcessor`) following the existing `Data/Processors` pattern;
  AutoMapper profile + view models following existing conventions.

EF migration must ship with its `.Designer.cs` + model snapshot (per prior
broken-migration lessons in this repo).

### 3. Backend API
New controller (e.g. `AgentRunsController`), `[RoleAuthorize(Role.Admin, Role.Moderator)]`:
- `POST /api/v1/agent-runs` — enqueue a run (body: report id or source URL). Returns the run.
- `GET  /api/v1/agent-runs` — list (paged) for the admin table.
- `GET  /api/v1/agent-runs/{id}` — full detail incl. article, findings, transcript.
- `POST /api/v1/agent-runs/{id}/approve` — promote result → `Report` + `Vulnerability`
  rows in `New` status, attributed to the `agent` identity; mark run `approved`.
- `POST /api/v1/agent-runs/{id}/reject` — mark `rejected`.
- `POST /api/v1/agent-runs/{id}/rerun` — enqueue a fresh run from the same input.
- Worker-facing endpoints (claim next queued run, submit result) — internal only.

### 4. Admin UI
Following the existing `UI/src/features/pages/admin/...` patterns (list-view +
edit/detail, hooks, MUI):
- **List view** of agent runs: status, source, model, when, duration.
- **Detail card**:
  - Rendered article via the existing `MarkdownView` component.
  - Extracted vulnerabilities table (title / severity / category / tags).
  - Collapsible "Agent reasoning" panel showing the raw transcript (monospace,
    read-only) — the "what it was thinking" view.
  - Actions: Approve / Reject / Re-run.
- A "Run agent" entry point: button on the report detail/admin page and/or a form to
  paste a source URL.

## Data flow on Approve
1. Validate the run is `succeeded` and not already promoted.
2. Create a `Report` (Name, Date, links to Protocol/Auditor *by match only* — unmatched
   left unset for the moderator), `MdFile` = the generated article, `Status = New`,
   `CreatedBy = agent`.
3. Create `Vulnerability` rows from `FindingsJson` (title, description markdown,
   severity, tags, category), `Status = New`, `CreatedBy = agent`, linked to the report.
4. Embeddings are generated by the existing background job (unchanged).
5. Mark `agent_run.approved`, store created ids for provenance.

## Security / safety
- Agent runs server-side in an isolated worker pod with only the outbound network it
  needs; the model API key is a K8s secret.
- All produced content lands in `New` (pending-review) and passes through existing
  moderation before going public — the agent never publishes directly.
- Existing content-filter / validation on report & vulnerability creation still applies
  on promotion.

## Testing
- Backend unit tests: `AgentRun` processor, controller authorization, the Approve
  promotion mapping (findings JSON → vulnerabilities), reject/rerun transitions.
- Worker: result-parsing (article + findings schema), failure/timeout handling — with
  OpenCode invocation mocked.
- UI: list + detail rendering, collapsible reasoning, Approve/Reject/Re-run wiring.
- Manual validation spike: run against 2–3 real Audit Bank reports (one Notion, one
  PDF, one blog) and compare output quality vs. the legacy Gemini pipeline. This
  doubles as the artifact for the item-12 discussion with Georgy.

## Relationship to existing code
- The Gemini pipeline (`Services/AgentServices/*`, `extract-vulnerabilities`) stays in
  place and dormant; not wired into the new flow. Removal is a later decision once the
  OpenCode path proves itself.
- Reuses existing `Report` / `Vulnerability` entities, moderation, `MarkdownView`,
  Helm chart, embeddings background job, and role authorization.

## Open questions for later phases
- Automatic discovery source (Airtable was dropped in favor of a future in-product
  registry + CSV import) — revisit after the Georgy discussion.
- CRON cadence and force-run-all semantics.
- Whether to auto-create Protocol/Auditor entities on approve vs. match-only.
- OpenCode model choice and prompt iteration (driven by the validation spike).

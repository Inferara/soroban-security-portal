# Agent Ingestion — Live Formatted Reasoning + Few-shot Examples & Dedup (Plan 4)

> Subagent-driven, TDD, in worktree `worktree-agent-audit-ingestion`. Real opencode only in a background subagent WITH a timer.

Two features:
- **A. Live, nicely-formatted reasoning** — the agent's reasoning streams into the detail page in real time during a run, rendered as formatted markdown (not raw monospace).
- **B. Few-shot examples + dedup** — the worker hands the agent existing portal articles + vulnerabilities as examples so output is uniform, and tells it not to duplicate existing findings.

---

## Feature B — Examples & dedup

### Task B1 (backend): internal examples endpoint
`GET /api/v1/agent-runs/internal/examples` (NO auth — cluster-internal, like the other `internal/*`). Returns `AgentExamplesViewModel`:
```csharp
public class AgentExampleArticle { public string Title=""; public string Markdown=""; }
public class AgentExampleVulnerability { public string Title=""; public string Severity=""; public int Category; public List<string> Tags=new(); public string Description=""; }
public class AgentExamplesViewModel {
  public List<AgentExampleArticle> Articles = new();          // up to 6 recent approved reports w/ non-empty MdFile
  public List<AgentExampleVulnerability> Vulnerabilities = new(); // up to 12 recent approved vulns (full, for style)
  public List<string> ExistingFindingTitles = new();          // ALL approved vuln titles (for dedup)
}
```
Service `AgentRunService.GetExamples()`: query via existing `IReportProcessor`/`IVulnerabilityProcessor` (approved, non-empty MdFile / approved vulns). Controller method (no `[RoleAuthorize]`), under `internal/examples`. Tests: service returns shaped data (mock processors); controller returns Ok.

### Task B2 (worker): inject examples + dedup prompt
- `IInternalApiClient.GetExamplesAsync(ct)` → GET `internal/examples`.
- `IngestionRunner.ProcessOneAsync`: fetch examples, pass to the prompt builder.
- `IngestionPrompt.BuildAsync(run, examples, ct)`: write `examples/articles/NN-<slug>.md`, `examples/vulnerabilities.json`, `examples/existing-finding-titles.txt` into the agent workspace dir, and add to the prompt: "The `examples/` folder holds existing portal articles and vulnerabilities. Match their structure, tone, severity wording, and tag vocabulary EXACTLY so output is uniform. Do NOT create a finding whose title duplicates any line in `examples/existing-finding-titles.txt`." (Examples are written into the SAME workspace dir OpenCodeRunner uses — so OpenCodeRunner must accept a pre-created workspace, or the prompt builder returns files to drop in. Simplest: OpenCodeRunner exposes the workspace via a callback / the runner takes an `IReadOnlyList<(path,content)> seedFiles`.)
- Tests: examples written to workspace; prompt references the folder + dedup file; mocked api client.

---

## Feature A — Live formatted reasoning

### Task A1 (worker): `--format json` parse → formatted markdown + progress callback
- OpenCodeRunner runs opencode with `--format json` (+ `--thinking` if supported). Parse the NDJSON event stream into a **formatted markdown transcript** (see captured schema in `docs/superpowers/spikes/jsonfmt-schema.md`): assistant text as-is; tool calls as `**🔧 tool:** name(args-summary)`; thinking as `> 💭 ...`; results trimmed. Build the transcript incrementally.
- Add `Action<string>? onProgress` to `IOpenCodeRunner.RunAsync` (or an event): called (throttled, e.g. every ~3s or every N events) with the current formatted transcript-so-far.
- Keep timeout/stall/kill behavior.

### Task A2 (backend): progress endpoint + transcript update
- `POST /api/v1/agent-runs/internal/{id}/progress` body `{ transcript }` → `AgentRunProcessor.UpdateTranscript(id, transcript)` (only updates `transcript`; leaves status=processing). No auth (internal).
- AgentRunViewModel already returns `transcript`. Tests: processor UpdateTranscript; controller Ok.

### Task A3 (worker): stream progress
- `IInternalApiClient.ProgressAsync(id, transcript, ct)` → POST `internal/{id}/progress`.
- `IngestionRunner`: pass an `onProgress` to the runner that throttle-posts the transcript via ProgressAsync while the run is in flight. Final transcript still goes in the submit.
- Tests: onProgress posts are made; failures in progress posting are swallowed (don't fail the run).

### Task A4 (UI): formatted + live reasoning
- Detail page: render the transcript with `MarkdownView` (formatted) instead of the raw monospace `<pre>`. Auto-expand the reasoning accordion while `status==='processing'`.
- Live polling: while `run.status==='processing'`, `setInterval` re-fetch `getAgentRunByIdCall(id)` every ~3s, update the run state (status + transcript), and clear the interval when status leaves processing or on unmount.
- Tests: renders transcript via MarkdownView; polling starts when processing and stops otherwise (mock timers + the hook).

---

## Verify
Local: full backend + worker + UI suites. Dev: redeploy api+ui (new tag), then via Playwright — simulate progressive `internal/{id}/progress` posts from inside the cluster and watch the reasoning update live + formatted on the detail page; confirm examples are returned by the endpoint.

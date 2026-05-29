# Agent Ingestion — OpenCode Worker (Plan 3)

> Execute subagent-driven in the worktree on `worktree-agent-audit-ingestion`. TDD. **Any REAL `opencode` invocation runs only in a dedicated background subagent WITH a hard `timeout` — never block the main loop. Build/unit tests MOCK the runner (no real opencode).**

**Goal:** a standalone worker that claims queued agent runs from the API's internal endpoints, runs an OpenCode agent (hang-proof) to produce `article.md` + `result.json`, and submits the result back. Plus Docker/Helm wiring incl. the hard Ingress exclusion for `internal/*`.

**Runtime decision:** a new **.NET console** `Backend/AgentIngestionWorker` (mirrors the user's proven `AgenticITReviewer` which shells a .NET host out to an agent CLI). Decoupled from the API (its own small DTOs + `HttpClient`); image = .NET runtime + Node + `opencode` CLI. Unit-testable with xUnit + the existing Moq harness.

**Auth/model (from Plan 2.5):** mount `~/.local/share/opencode/auth.json` = `{"zai-coding-plan":{"type":"api","key":"<K8s secret>"}}`; model `zai-coding-plan/glm-5.1`.

## Agent output contract (refines the spike)
The prompt makes the agent write two files in its workspace dir:
- `article.md` — the consistent article (as in the spike).
- `result.json` — `{ "reportTitle": string, "protocolName": string, "auditorName": string, "reportDate": "YYYY-MM-DD"|null, "findings": [ {title, description, severity, tags[], category} ] }`.
The runner reads both; the worker maps → `SubmitAgentRunResultViewModel` (ArticleMarkdown, FindingsJson = serialized `findings`, ReportTitle/ProtocolName/AuditorName/ReportDate, Transcript = captured stdout, DurationMs, Success/Error).

---

## Task 1 — `OpenCodeRunner` (hang-proof shell-out) [pure .NET, unit-tested, NO real opencode]

**Files:** `Backend/AgentIngestionWorker/` new console project (`Program.cs` stub, `.csproj`), `OpenCode/IOpenCodeRunner.cs`, `OpenCode/OpenCodeRunner.cs`, `OpenCode/OpenCodeResult.cs`; tests `Backend/AgentIngestionWorker.Tests/`. Add both to `Reviewer`/solution? — add to the existing `.sln` (`Backend/SorobanSecurityPortalApi.sln` or whatever the solution file is; check).

- `OpenCodeResult { bool Success; string ArticleMarkdown; string FindingsJson; string Transcript; string? Error; long DurationMs; }`.
- `IOpenCodeRunner.RunAsync(string promptText, CancellationToken ct) : Task<OpenCodeResult>`.
- `OpenCodeRunner` mirrors `ClaudeCodeRunner`:
  - Creates a fresh temp workspace dir; writes nothing there (agent writes article.md/result.json).
  - `ProcessStartInfo("opencode")` args: `run`, `-m <model>`, `--dangerously-skip-permissions`, `--print-logs`, `--log-level`, `ERROR`, `--dir <ws>`, then the prompt as the message; `UseShellExecute=false`, redirect stdout+stderr+stdin, `CreateNoWindow`.
  - `HOME`/env so opencode finds its mounted `auth.json`; `PATH` includes node/opencode dir.
  - **Timeout via `CancellationTokenSource.CreateLinkedTokenSource(ct)` + `CancelAfter(_timeout)`**; stream stdout with `ReadLineAsync(cts.Token)`; **background stderr reader**; `process.StandardInput.Close()` immediately. On `OperationCanceledException` (timeout) → `process.Kill(entireProcessTree:true)`, return `Success=false, Error="timeout after Nm"`, Transcript=captured-so-far.
  - **Progress watchdog (the anti-hang):** if no stdout line AND no growth of `<ws>` files for `_stallSeconds` (e.g. 90s), kill the tree and return `Error="no progress (stalled)"`. (Implement as a periodic check task racing the read loop.)
  - On normal exit: read `<ws>/article.md` and `<ws>/result.json`; if both present and result.json parses → `Success=true`, populate ArticleMarkdown + FindingsJson(=serialized findings array) + the meta is parsed by the worker (Task 2) or returned raw. Keep it simple: `OpenCodeResult` returns `ArticleMarkdown`, `ResultJson` (raw result.json text), `Transcript`, `Success`, `Error`, `DurationMs`. (Worker parses ResultJson.)
  - Always clean up the temp workspace.
- **Make it unit-testable:** extract the actual process launch behind a thin seam — e.g. constructor takes a `Func<ProcessStartInfo>` or an `IProcessLauncher` so tests inject a FAKE that simulates: (a) success (writes article.md+result.json, exits 0), (b) timeout (never exits), (c) crash (exit≠0 + stderr). Tests assert the result mapping + timeout→kill + stall→kill WITHOUT launching real opencode. Alternatively point the runner at a tiny cross-platform fake script. **Do NOT invoke real opencode in any test.**

**Acceptance:** unit tests green for success/timeout/stall/crash/missing-files; build green. No real opencode call.

---

## Task 2 — worker loop (`IngestionRunner`) [pure .NET, unit-tested with mocked runner + fake HTTP]

**Files:** `Backend/AgentIngestionWorker/Api/IInternalApiClient.cs` + `InternalApiClient.cs` (HttpClient to `claim-next` / `{id}/submit`), `Worker/IngestionRunner.cs`, small DTOs (`ClaimedRun`, `SubmitResultDto` matching the API JSON), tests.

- `IInternalApiClient.ClaimNextAsync(ct) : Task<ClaimedRun?>` → POST `internal/claim-next` (204→null, 200→run with id/sourceUrl/reportId/model). `SubmitAsync(id, SubmitResultDto, ct)` → POST `internal/{id}/submit`.
- `IngestionRunner.ProcessOneAsync(ct)`: claim → if null return false; build prompt from the run (SourceUrl); `_runner.RunAsync(prompt)`; map result → `SubmitResultDto{ Success, ArticleMarkdown, FindingsJson, Transcript, DurationMs, ReportTitle/ProtocolName/AuditorName/ReportDate (parsed from ResultJson), Error }`; submit; return true.
- `RunLoopAsync(ct)`: loop `ProcessOneAsync`; when it returns false (queue empty) sleep `_pollInterval`; honor cancellation.
- Robust: any exception in processing → submit `Success=false, Error=ex.Message` (so the run is marked failed, never left processing); never throw out of the loop.
- Tests (mock `IOpenCodeRunner` + `IInternalApiClient`): claim→run→submit happy path maps fields incl. parsed meta; empty queue → false, no submit; runner failure/timeout → submit Success=false+Error; malformed ResultJson → submit with empty findings + Error note (don't crash).

**Acceptance:** unit tests green; loop never throws; failures become `submit(Success=false)`.

---

## Task 3 — prompt + PDF handling [pure .NET, unit-tested]

**Files:** `Worker/IngestionPrompt.cs` (builds the prompt text incl. the `result.json` schema + metadata extraction), PDF pre-handling in the worker.

- Prompt: based on the validated spike prompt, but require BOTH `article.md` and `result.json` (with reportTitle/protocolName/auditorName/reportDate + findings[]). observation/informational→`note`; fixed→category 0.
- **PDF handling (the spike's hang lesson):** if the source is a PDF (URL ends `.pdf` or HEAD content-type `application/pdf`), the worker downloads it and converts to text/markdown BEFORE the agent — reuse the API's existing `PdfToMarkdownConverter` logic (copy/extract into a shared spot, or re-implement minimally) — then pass the extracted TEXT to the agent (prompt: "here is the report content: …") instead of a URL the agent can't read. Non-PDF → pass the URL for the agent to fetch.
- Tests: prompt contains the schema + the URL/text; PDF detection by extension/content-type; conversion invoked for PDF path (mock the converter).

**Acceptance:** unit tests green; PDF path converts before the agent.

---

## Task 4 — Docker + Helm + Ingress exclusion [write; deploy-tested later]

**Files:** `Backend/AgentIngestionWorker/Dockerfile` (.NET runtime + Node + `npm i -g opencode-ai` + the published worker), Helm: a `worker` Deployment in `Deploy/helm` (env: API base URL, model, poll interval, timeout; mount the `auth.json` secret), and **the HARD Ingress change**: exclude `/api/v1/agent-runs/internal/` from the public Traefik IngressRoute (so only in-cluster can reach claim/submit). Document in the deployment notes that this exclusion is a release gate.

**Acceptance:** manifests render (`helm template` if available); reviewed; NOT deployed here.

---

## Task 5 — real integration run [BACKGROUND SUBAGENT + TIMER ONLY]

Run the published worker (or the runner directly) against a real report end-to-end, in a dedicated background subagent with a hard `timeout` and `--print-logs`; verify a run goes queued→processing→succeeded with article+findings, then approve via the UI/API. Capture as evidence.

---

## Carried risks (address before/with deploy — see spec Risks)
- **Prompt injection** from report content (agent has tools + skip-permissions) → keep the agent's toolset minimal; treat all agent output as untrusted; human review is the gate; consider a non-tool "extract from this text" mode for PDF/text path.
- **SSRF** via the agent's own fetch / the `SourceUrl` → validate `SourceUrl` on enqueue (reuse `UrlValidator.IsUrlSafeForFetch`); restrict worker pod egress.
- **Dedup** vs existing reports/vulns; **copyright/attribution** policy for republished content.

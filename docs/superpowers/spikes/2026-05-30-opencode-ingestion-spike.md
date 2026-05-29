# OpenCode audit-ingestion validation spike

**Date:** 2026-05-30
**Goal (roadmap items 11/12):** prove that an OpenCode CLI agent driving a capable model can read a *real* Soroban audit report and produce (a) a consistent Markdown article and (b) structured vulnerabilities matching our `AgentFinding` contract — the thesis behind replacing the legacy Gemini-flash pipeline.

**Verdict: validated.** On the Hacken "Rozo" Soroban audit, the agent extracted **8/8 findings**, schema-valid, with correct severities, category, tags, and real code snippets, plus an accurate article.

## Working setup (note the provider gotcha)

- OpenCode `v1.14.28`, authenticated via `opencode auth login` → **"Z.AI Coding Plan"** (key from https://z.ai/manage-apikey/apikey-list).
- **Model: `zai-coding-plan/glm-5.1`** — the Coding-Plan provider, which routes to Z.AI's **Anthropic-compatible** endpoint (`https://api.z.ai/api/anthropic`).
- **GOTCHA (cost us an hour):** the look-alike `zai/glm-5.1` provider routes to the **pay-as-you-go** endpoint (`https://api.z.ai/api/paas/v4/chat/completions`), which returned **HTTP 429 / code 1113 "Insufficient balance or no resource package"**. The Coding-Plan subscription only covers the `zai-coding-plan/*` (Anthropic) route. Plan 3 must use `zai-coding-plan/*` (or set `ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic`), not the PaaS provider. (Reference: this repo's sibling `AgenticITReviewer` uses exactly `ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic` + model `glm-5.1`.)

Command used:
```bash
opencode run -m zai-coding-plan/glm-5.1 --dangerously-skip-permissions "$(cat prompt.txt)"
```

## The prompt / contract

See `rozo-sample/prompt.txt`. It instructs the agent to fetch a report URL and emit exactly `article.md` (fixed section structure) and `findings.json` — a JSON array where each element is `{title, description, severity: critical|high|medium|low|note, tags: string[], category: 0|1|2|3|100}`, i.e. the frontend/backend `AgentFinding` shape. Observation/informational → `note`; fixed findings → `category: 0` (Valid).

## Source tested

Hacken "Rozo" (ROZO Intents V2) — Stellar/Soroban, Rust — https://hacken.io/audits/rozo/sca-rozo-sdf-audit-mar2026/. Findings are in readable HTML. Ground truth: 8 findings (1 Medium, 2 Low, 5 Observations), all resolved, no critical/high.

## Results (see `rozo-sample/`)

- `findings.json`: **valid JSON, 8 elements**, every element has the full schema. Severities `[medium, note×5, low×2]` (observations correctly mapped to `note`); all `category: 0` (correctly inferred from "fixed"); descriptive tags (e.g. `["ttl","storage","forwarder","memo-mapping","soroban"]`).
- `article.md`: correct title/metadata, an accurate summary, a detailed Scope block that even recovered the GitHub repo, commit `1c2f003`, and 97.69% test coverage (deeper than the page's headline summary), and one `### ` subsection per finding with **Severity**, description, real Rust snippets from the contracts, and **Recommendation** (with fix code).
- Transcript confirms the agent used its `WebFetch` tool on the exact URL — the agentic fetch/read loop, not a single lossy dump.

## Caveats / Plan 3 implications

1. **PDF sources hang the agent.** A first attempt on Certora's Blend report (`certora.com/reports/blend`) — a landing page linking to a **PDF** — ran 24 min with zero progress (no PDF-reading tool; the fetch tool stalls on the binary). **Plan 3 must handle PDFs explicitly** (download + convert to text/markdown before/within the agent, or restrict the prompt to HTML/Notion/markdown sources). This matches the design's PDF→markdown concern.
2. Always run the worker with a hard timeout (the spike used 7 min) so a stuck fetch can't hang a job.
3. `--dangerously-skip-permissions` is required for headless tool use (web fetch + file writes); the worker pod runs sandboxed, so this is acceptable there.
4. Model/cost: `glm-5.1` via the Coding Plan produced this in ~a few minutes; quality was high. Worth A/B-ing against `glm-4.7` and a Claude model for the production prompt.

## Conclusion

The agentic-ingestion approach produces exactly the consistent article + structured findings the portal needs, on a real heterogeneous source — validating items 11/12. Proceed to **Plan 3** (the worker container) using the `zai-coding-plan` provider + this prompt as the starting contract, and add PDF handling. This spike's `article.md` + `findings.json` are the artifact to show Dominik/Georgy.

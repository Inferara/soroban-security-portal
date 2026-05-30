# Agent Ingestion Worker — Deployment Notes

Generated as part of Plan 3 Task 4. These notes are the release checklist for the
first deploy of the worker alongside the updated API + Ingress exclusion.

---

## Images to build and push

Three images must be built from `Backend/` (the `COPY . .` context is the entire
`Backend/` directory, same as the existing API build):

| Image | Dockerfile | Tag example |
|---|---|---|
| `docker.io/andreykerchin/soroban-security-portal` | `Backend/Dockerfile` | `agent-worker-v1` |
| `docker.io/andreykerchin/soroban-security-portal-ui` | `UI/Dockerfile` | `agent-worker-v1` |
| `docker.io/andreykerchin/agent-ingestion-worker` | `Backend/AgentIngestionWorker/Dockerfile` | `agent-worker-v1` |

Build commands (run from repo root):

```bash
# API
docker build -t docker.io/andreykerchin/soroban-security-portal:agent-worker-v1 ./Backend

# UI  (adjust path if UI has its own Dockerfile)
docker build -t docker.io/andreykerchin/soroban-security-portal-ui:agent-worker-v1 ./UI

# Worker (build context = Backend/ so dotnet restore can copy the .csproj)
docker build \
  -f Backend/AgentIngestionWorker/Dockerfile \
  -t docker.io/andreykerchin/agent-ingestion-worker:agent-worker-v1 \
  ./Backend

docker push docker.io/andreykerchin/soroban-security-portal:agent-worker-v1
docker push docker.io/andreykerchin/soroban-security-portal-ui:agent-worker-v1
docker push docker.io/andreykerchin/agent-ingestion-worker:agent-worker-v1
```

---

## Helm upgrade command

```bash
helm upgrade sorobansecurityportal Deploy/helm \
  -n sorobansecurityportal-ns \
  --reuse-values \
  --set global.sorobansecurityportal.service.tag=agent-worker-v1 \
  --set-string global.app.build=<build-number> \
  --set global.secrets.zaiCodingPlanKey=<REAL_KEY_HERE>
```

> NEVER commit the real `zaiCodingPlanKey` value. Pass it at deploy time only.

### Worker-specific toggles

| Flag | Default | Purpose |
|---|---|---|
| `agentIngestionWorker.enabled` | `true` | Set to `false` to skip the worker on envs where it is not yet active |
| `agentIngestionWorker.pollIntervalSeconds` | `15` | Queue poll interval in seconds |
| `global.secrets.zaiCodingPlanKey` | `""` (empty) | zai-coding-plan API key — **deploy-time secret only** |

---

## RELEASE GATE — Ingress exclusion

**The Ingress exclusion for `/api/v1/agent-runs/internal/` MUST be verified before
going live with the worker.**

The internal claim/submit endpoints are unauthenticated by design (only the in-cluster
worker pod should reach them). The updated IngressRoute (Traefik CRD) rule is:

```
Host(`<domain>`) && PathPrefix(`/api`) && !PathPrefix(`/api/v1/agent-runs/internal`)
```

Verification steps:
1. After deploy, `curl -v https://<domain>/api/v1/agent-runs/internal/claim-next` from
   outside the cluster MUST return 404 or connection refused (Traefik drops the request).
2. From inside the cluster (e.g. `kubectl exec` into the worker pod):
   `curl -v http://<env>-sorobansecurityportal-api-ip:8080/api/v1/agent-runs/internal/claim-next`
   MUST return 200 or 204.
3. Check that `/api/v1/agent-runs/` (public listing) still responds correctly from outside.

---

## auth.json secret layout

The worker expects the opencode auth file at:
```
/home/worker/.local/share/opencode/auth.json
```
Content format (this is what the Helm Secret renders):
```json
{"zai-coding-plan":{"type":"api","key":"<key>"}}
```
The `HOME=/home/worker` env var is set in the Deployment so opencode resolves the
XDG path correctly. An init container creates the parent directories before the main
container starts (required because `subPath` volume mounts do not create parent dirs).

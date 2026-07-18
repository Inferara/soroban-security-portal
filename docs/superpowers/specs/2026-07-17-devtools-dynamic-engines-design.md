# Dev Tools: dynamic soroban-ret engine versions

**Date:** 2026-07-17
**Status:** Approved
**Related:** `DevTools/` (issue #206, PR #207), [Inferara/soroban-ret](https://github.com/Inferara/soroban-ret)

## Problem

The `/dev-tools` page offers a soroban-ret version dropdown, but in practice only
one version is available: the `soroban-ret` **library** compiled into
`soroban-ret-web` (currently 0.0.3). Additional versions can only be registered
as external CLI binaries via the `DEVTOOLS_RET_BINARIES` env var, which requires
baking binaries into the image and editing deploy config — in effect, every new
crate release means rebuilding and redeploying the backend.

Upstream facts (verified 2026-07-17):

- `soroban-ret` on crates.io is **library-only** (no binaries).
- `soroban-ret-cli` on crates.io publishes a `soroban-ret` binary for every
  version (0.0.1–0.0.3), so `cargo install soroban-ret-cli --version X` works.
- GitHub releases of `Inferara/soroban-ret` carry **no** prebuilt assets, and we
  have read-only access to that repo (no way to add a release workflow there).
- The production node is a single 1-CPU machine — compiling engines in-cluster
  is not acceptable (a `cargo build` would starve the live portal).

Additionally, a real bug exists today: `main.rs` hardcodes
`RET_VERSION = "0.0.2"` while `Cargo.toml` depends on soroban-ret 0.0.3 — the
last dependency bump forgot the constant, so `/versions` misreports `current`.
This is a direct consequence of the manual process.

## Decision

Build engine binaries **in GitHub Actions CI** (fast, free CPU), upload them
**into the cluster** via `kubectl exec` streaming onto a PVC, and have
`soroban-ret-web` **scan that directory** to register versions dynamically.
(Originally specified as `kubectl cp`; implementation switched to
`kubectl exec -i … "cat > …"` streaming — same kubectl trust model, but no
tar dependency in the container and immune to Git-Bash path mangling.) No GitHub releases,
no new public endpoints, no image rebuilds when a new crate version appears.

Rejected alternatives:

- **Release CI in soroban-ret** — no write access to that repo.
- **`cargo install` at container startup** — minutes-to-tens-of-minutes per
  version on the 1-CPU node; toolchain only exists in the full (~2.8GB) image.
- **Scheduled image rebuild** — still a rebuild/redeploy per release.
- **In-cluster CronJob building on a PVC** — build load lands on the weak
  production node.
- **Authenticated upload endpoint on soroban-ret-web** — new public attack
  surface accepting executables; `kubectl cp` reuses existing trust instead.
- **GitHub release assets as transfer point** — workable, but requires runtime
  egress from the pod (flaky on our node) and hosts artifacts publicly for no
  benefit; `kubectl cp` is strictly simpler.

## Design

### 1. soroban-ret-web: engines directory scan

- New flag/env: `--engines-dir` / `DEVTOOLS_ENGINES_DIR`. Default: unset
  (feature disabled — local dev behavior unchanged).
- `Registry` gains a third version source, alongside the builtin library and
  `DEVTOOLS_RET_BINARIES` (both keep working unchanged): files in the engines
  directory named exactly `soroban-ret-<semver>` (e.g. `soroban-ret-0.0.4`).
- The directory is **rescanned on every `available()` / `resolve()` call**.
  A readdir of a tiny directory costs microseconds; in exchange there are no
  background tasks, no locks, no restarts — a newly uploaded file shows up in
  the dropdown on the next `GET /versions`.
- Scan filters:
  - name must match `^soroban-ret-(\d+\.\d+\.\d+)$` (dotfiles, `.tmp` files and
    anything else are ignored);
  - the file must be a regular file (with the executable bit set, on Unix);
  - a version equal to the builtin library version is ignored (the builtin
    in-process engine produces richer output);
  - on collision with a `DEVTOOLS_RET_BINARIES` entry, the env entry wins
    (explicit operator config beats convention).
- Resolved directory entries produce the existing `Engine::Cli` — the shell-out
  path, 60s timeout, and error surfacing are all reused as-is.

### 2. Fix: derive the builtin version at build time

Delete the hardcoded `RET_VERSION` constant. A `build.rs` parses `Cargo.lock`,
finds the `soroban-ret` package version, and exports it as a compile-time env
(`cargo:rustc-env=RET_VERSION=...`) consumed via `env!("RET_VERSION")`.
Bumping the dependency can then never desynchronize the reported version again.

### 3. CI: `.github/workflows/devtools-engines.yml`

Triggers: `schedule` (daily) + `workflow_dispatch`.

Steps:

1. Query crates.io for all non-yanked `soroban-ret-cli` versions.
2. `kubectl exec` into the soroban-ret-web pod: `ls /engines` → currently
   uploaded versions.
3. For each missing version:
   - `cargo install soroban-ret-cli --version X --target x86_64-unknown-linux-musl`
     on the runner (musl → static binary, runs on any Linux including the K3S
     node and the runner itself);
   - smoke-test on the runner: disassemble a fixture WASM, non-empty output;
   - upload atomically: stream via `kubectl exec -i … "cat > /engines/.soroban-ret-<X>.tmp"`,
     then `kubectl exec mv` to the final name (the scanner never sees a
     partial file).
4. Log a summary of what was added / skipped.

The upload logic lives in `DevTools/scripts/upload-engines.sh` so it can also be
run by hand. The workflow targets production via the existing
`secrets.KUBECONFIG`; the dev cluster (deployed locally by the maintainer) is
served by running the same script manually with the local kubeconfig.

### 4. Helm

In the `sorobanretweb` subchart:

- a `PersistentVolumeClaim` `soroban-ret-engines`, 1Gi,
  `storageClassName: local-path` (same class postgres uses);
- mounted at `/engines` in the pod;
- env `DEVTOOLS_ENGINES_DIR=/engines`.

The Deployment already uses the `Recreate` strategy (single 1-CPU node), so an
RWO PVC introduces no rollout deadlock.

`Backend/docker-compose.yml` gets an equivalent named volume + env so the
compose path behaves the same.

### 5. UI

No changes. The dropdown already renders `available[]` from `/versions` and the
selected version is already honored by every endpoint.

### 6. Failure modes

| Case | Behavior |
|---|---|
| Corrupt/foreign file in `/engines` | Filtered out by the scan (name/executable checks), or fails per-request exactly like a bad `DEVTOOLS_RET_BINARIES` path today; the UI already surfaces engine errors. |
| PVC lost | Dropdown degrades to the builtin version; a manual workflow dispatch repopulates. |
| crates.io unreachable in CI | Workflow run fails visibly; nothing changes in the cluster; next run catches up. |
| Version yanked after upload | The binary stays available (already vetted); the workflow simply never re-uploads yanked versions. |
| Security | No new public surface: writing to the PVC requires kubectl access, the same trust already granted to the deploy workflow. The scanner only executes files matching the strict naming convention on an operator-controlled volume. |

## Testing

- **Rust unit tests** for the directory scan: regex filtering, ignoring
  dotfiles/tmp/non-executables, builtin shadowing, env-entry precedence,
  natural version sort order.
- **build.rs**: unit test asserting the exported version equals the
  `soroban-ret` entry in `Cargo.lock`.
- **Smoke test in CI** for every built binary before upload (fixture
  disassembly on the runner).
- **E2e on dev**: build 0.0.1/0.0.2, upload via the script, verify the dropdown
  lists them without a pod restart and that disassembly through each version
  works end-to-end.

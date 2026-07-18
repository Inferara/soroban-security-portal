# Dev Tools Dynamic Engine Versions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every published `soroban-ret-cli` version selectable on `/dev-tools` without rebuilding or redeploying the backend: CI builds static engine binaries and `kubectl cp`s them onto a PVC that `soroban-ret-web` rescans on every request.

**Architecture:** Three independent pieces glued by a file-naming convention (`soroban-ret-<semver>` in `/engines`): (1) `soroban-ret-web` gains a `DEVTOOLS_ENGINES_DIR` scanned lazily on each `available()`/`resolve()` call; (2) a scheduled GitHub workflow builds missing versions with `cargo install --target x86_64-unknown-linux-musl` on the runner and uploads them atomically via `kubectl cp` + `mv`; (3) the Helm chart adds the PVC/mount/env. A `build.rs` derives the builtin library version from `Cargo.lock`, fixing the stale `RET_VERSION = "0.0.2"` constant.

**Tech Stack:** Rust (axum service, edition 2024, rust ≥1.95), Bash, GitHub Actions, Helm/K3S, Docker.

**Spec:** `docs/superpowers/specs/2026-07-17-devtools-dynamic-engines-design.md`

## Global Constraints

- Engine file naming convention: `soroban-ret-<semver>` where semver matches `^\d+\.\d+\.\d+$`; anything else in the dir is ignored (dotfiles, `.tmp`, non-executables).
- Precedence: builtin library > `DEVTOOLS_RET_BINARIES` env entries > engines-dir files. A dir/env version equal to the builtin is ignored.
- `DEVTOOLS_ENGINES_DIR` unset ⇒ feature fully disabled (local dev unchanged).
- Build target for uploaded engines: `x86_64-unknown-linux-musl` (static, runs on the K3S node and on GitHub runners).
- Upload must be atomic: copy to `.soroban-ret-<v>.tmp`, then `mv` to the final name.
- No new public endpoints; upload happens only via kubectl (existing `secrets.KUBECONFIG` trust).
- PVC: `local-path` storage class (same as postgres), 1Gi, mounted at `/engines`.
- All Rust work happens in `DevTools/soroban-ret-web`. Run tests with `cargo test` in that directory. If the machine has no Rust ≥1.95 toolchain, run instead: `docker run --rm -v "${PWD}:/app" -w /app rust:1.96-bookworm cargo test` (from `DevTools/soroban-ret-web`; PowerShell: replace `${PWD}` with `${PWD}.Path`).
- Commit messages: plain human style, no AI/Claude mentions (user's global rule).

---

### Task 1: Derive the builtin version from Cargo.lock (`build.rs`)

Fixes the live bug: `main.rs:42` hardcodes `RET_VERSION = "0.0.2"` while `Cargo.toml` depends on soroban-ret 0.0.3, so `/versions` misreports `current`.

**Files:**
- Create: `DevTools/soroban-ret-web/build.rs`
- Modify: `DevTools/soroban-ret-web/src/main.rs:41-42` (the `RET_VERSION` const)
- Test: inline test module added in `DevTools/soroban-ret-web/src/engine.rs` (Task 2 extends this module; if executing this task first, create the `#[cfg(test)] mod tests` block at the end of `engine.rs`)

**Interfaces:**
- Produces: compile-time env `RET_VERSION` (via `env!("RET_VERSION")`), equal to the `soroban-ret` version pinned in `Cargo.lock`. `main.rs` keeps exporting `const RET_VERSION: &str` with the same name, so no other call sites change.

- [ ] **Step 1: Write the failing test**

Append to `DevTools/soroban-ret-web/src/engine.rs` (create the module if absent):

```rust
#[cfg(test)]
mod tests {
    /// The version reported as "builtin" must always equal the soroban-ret
    /// entry in Cargo.lock — guards against the stale-constant bug where the
    /// dependency was bumped to 0.0.3 but the constant said 0.0.2.
    #[test]
    fn builtin_version_matches_cargo_lock() {
        let lock = include_str!("../Cargo.lock");
        let mut in_ret_package = false;
        let mut lock_version = None;
        for line in lock.lines() {
            let line = line.trim();
            if line == "[[package]]" {
                in_ret_package = false;
            } else if line == "name = \"soroban-ret\"" {
                in_ret_package = true;
            } else if in_ret_package {
                if let Some(v) = line.strip_prefix("version = ") {
                    lock_version = Some(v.trim_matches('"').to_string());
                    break;
                }
            }
        }
        let lock_version = lock_version.expect("soroban-ret not found in Cargo.lock");
        assert_eq!(env!("RET_VERSION"), lock_version);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `DevTools/soroban-ret-web`): `cargo test builtin_version_matches_cargo_lock`
Expected: **compile error** — `error: environment variable `RET_VERSION` not defined` (that is the failing state: the build-time env doesn't exist yet).

- [ ] **Step 3: Create `DevTools/soroban-ret-web/build.rs`**

```rust
//! Exports RET_VERSION: the exact `soroban-ret` library version from
//! Cargo.lock. Keeps the version reported by /versions in lockstep with the
//! dependency — bumping Cargo.toml can no longer desynchronize the constant.

fn main() {
    println!("cargo:rerun-if-changed=Cargo.lock");
    let lock = std::fs::read_to_string("Cargo.lock").expect("failed to read Cargo.lock");
    let mut in_ret_package = false;
    let mut version = None;
    for line in lock.lines() {
        let line = line.trim();
        if line == "[[package]]" {
            in_ret_package = false;
        } else if line == "name = \"soroban-ret\"" {
            in_ret_package = true;
        } else if in_ret_package {
            if let Some(v) = line.strip_prefix("version = ") {
                version = Some(v.trim_matches('"').to_string());
                break;
            }
        }
    }
    let version = version.expect("soroban-ret package not found in Cargo.lock");
    println!("cargo:rustc-env=RET_VERSION={}", version);
}
```

Note: `[[package]]` blocks in Cargo.lock list keys alphabetically, so `name` always precedes `version`; the exact-match on `name = "soroban-ret"` cannot confuse `soroban-ret-web` (different string).

- [ ] **Step 4: Point the constant at the build-time env**

In `DevTools/soroban-ret-web/src/main.rs`, replace:

```rust
/// soroban-ret library version this service is built against.
const RET_VERSION: &str = "0.0.2";
```

with:

```rust
/// soroban-ret library version this service is built against — derived from
/// Cargo.lock by build.rs, so it can never go stale on a dependency bump.
const RET_VERSION: &str = env!("RET_VERSION");
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cargo test builtin_version_matches_cargo_lock`
Expected: PASS (and the value is now `0.0.3`).

- [ ] **Step 6: Run the whole suite**

Run: `cargo test`
Expected: all existing tests (compile.rs, rpc.rs) still pass.

- [ ] **Step 7: Commit**

```bash
git add DevTools/soroban-ret-web/build.rs DevTools/soroban-ret-web/src/main.rs DevTools/soroban-ret-web/src/engine.rs
git commit -m "Derive the builtin soroban-ret version from Cargo.lock

The RET_VERSION constant said 0.0.2 while Cargo.toml already depended on
0.0.3, so /versions misreported the current engine. build.rs now reads the
version from Cargo.lock at compile time."
```

---

### Task 2: Engines-directory scan in `Registry`

**Files:**
- Modify: `DevTools/soroban-ret-web/src/engine.rs` (Registry struct + new scan logic + tests)
- Modify: `DevTools/soroban-ret-web/src/main.rs` (new `--engines-dir` flag, wire into Registry, log line)

**Interfaces:**
- Consumes: `env!("RET_VERSION")` from Task 1 (unchanged name `RET_VERSION` const in main.rs).
- Produces:
  - `Registry::from_env(builtin_version: &str, engines_dir: Option<PathBuf>) -> Registry` (signature gains the second parameter; the only caller is `main.rs`).
  - Private `Registry::new(builtin_version: &str, clis: BTreeMap<String, PathBuf>, engines_dir: Option<PathBuf>) -> Registry` used by tests.
  - `available()` / `resolve()` keep their existing signatures — handlers don't change.
  - `engine_file_version(name: &str) -> Option<&str>` module-private helper.

- [ ] **Step 1: Write the failing tests**

Extend the `#[cfg(test)] mod tests` block in `engine.rs` (added in Task 1) — new imports and tests:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::Path;
    use std::sync::atomic::{AtomicU32, Ordering};

    static DIR_SEQ: AtomicU32 = AtomicU32::new(0);

    /// Fresh per-test scratch dir (no tempfile dependency).
    fn temp_engines_dir() -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "ret-web-engines-test-{}-{}",
            std::process::id(),
            DIR_SEQ.fetch_add(1, Ordering::Relaxed)
        ));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn add_engine_file(dir: &Path, name: &str) -> PathBuf {
        let path = dir.join(name);
        fs::write(&path, b"#!/bin/sh\nexit 0\n").unwrap();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&path, fs::Permissions::from_mode(0o755)).unwrap();
        }
        path
    }

    fn registry(builtin: &str, clis: &[(&str, &str)], dir: Option<PathBuf>) -> Registry {
        let clis = clis
            .iter()
            .map(|(v, p)| ((*v).to_string(), PathBuf::from(p)))
            .collect();
        Registry::new(builtin, clis, dir)
    }

    #[test]
    fn scan_registers_convention_named_files() {
        let dir = temp_engines_dir();
        add_engine_file(&dir, "soroban-ret-0.0.1");
        add_engine_file(&dir, "soroban-ret-0.0.2");
        let reg = registry("0.0.3", &[], Some(dir));
        assert_eq!(reg.available(), vec!["0.0.3", "0.0.2", "0.0.1"]);
    }

    #[test]
    fn scan_ignores_tmp_dotfiles_and_foreign_names() {
        let dir = temp_engines_dir();
        add_engine_file(&dir, ".soroban-ret-0.0.9.tmp"); // in-flight upload
        add_engine_file(&dir, "soroban-ret-abc");        // not a semver
        add_engine_file(&dir, "soroban-ret-0.1");        // two components
        add_engine_file(&dir, "soroban-ret-0.0.2.exe");  // trailing garbage
        add_engine_file(&dir, "readme.txt");
        let reg = registry("0.0.3", &[], Some(dir));
        assert_eq!(reg.available(), vec!["0.0.3"]);
    }

    #[test]
    fn dir_version_equal_to_builtin_is_ignored() {
        let dir = temp_engines_dir();
        add_engine_file(&dir, "soroban-ret-0.0.3");
        let reg = registry("0.0.3", &[], Some(dir));
        assert_eq!(reg.available(), vec!["0.0.3"]);
        // Resolving it must yield the (richer) builtin engine, not the CLI.
        assert!(matches!(reg.resolve(Some("0.0.3")).unwrap(), Engine::Builtin));
    }

    #[test]
    fn env_entry_wins_over_dir_entry() {
        let dir = temp_engines_dir();
        add_engine_file(&dir, "soroban-ret-0.0.1");
        let reg = registry("0.0.3", &[("0.0.1", "/explicit/soroban-ret")], Some(dir));
        match reg.resolve(Some("0.0.1")).unwrap() {
            Engine::Cli { path, .. } => assert_eq!(path, PathBuf::from("/explicit/soroban-ret")),
            Engine::Builtin => panic!("expected CLI engine"),
        }
    }

    #[test]
    fn resolve_dir_engine_returns_cli_with_scanned_path() {
        let dir = temp_engines_dir();
        let bin = add_engine_file(&dir, "soroban-ret-0.0.1");
        let reg = registry("0.0.3", &[], Some(dir));
        match reg.resolve(Some("0.0.1")).unwrap() {
            Engine::Cli { version, path } => {
                assert_eq!(version, "0.0.1");
                assert_eq!(path, bin);
            }
            Engine::Builtin => panic!("expected CLI engine"),
        }
    }

    #[test]
    fn resolve_unknown_version_errors() {
        let reg = registry("0.0.3", &[], None);
        assert!(reg.resolve(Some("9.9.9")).is_err());
    }

    #[test]
    fn missing_dir_yields_builtin_only() {
        let reg = registry(
            "0.0.3",
            &[],
            Some(std::env::temp_dir().join("ret-web-engines-does-not-exist")),
        );
        assert_eq!(reg.available(), vec!["0.0.3"]);
    }

    #[test]
    fn versions_sort_naturally_newest_first() {
        let dir = temp_engines_dir();
        add_engine_file(&dir, "soroban-ret-0.0.10");
        add_engine_file(&dir, "soroban-ret-0.0.2");
        let reg = registry("0.0.3", &[], Some(dir));
        assert_eq!(reg.available(), vec!["0.0.10", "0.0.3", "0.0.2"]);
    }

    #[cfg(unix)]
    #[test]
    fn non_executable_files_are_ignored() {
        use std::os::unix::fs::PermissionsExt;
        let dir = temp_engines_dir();
        let path = add_engine_file(&dir, "soroban-ret-0.0.1");
        fs::set_permissions(&path, fs::Permissions::from_mode(0o644)).unwrap();
        let reg = registry("0.0.3", &[], Some(dir));
        assert_eq!(reg.available(), vec!["0.0.3"]);
    }

    #[test]
    fn engine_file_version_accepts_only_strict_semver() {
        assert_eq!(engine_file_version("soroban-ret-0.0.4"), Some("0.0.4"));
        assert_eq!(engine_file_version("soroban-ret-10.2.33"), Some("10.2.33"));
        assert_eq!(engine_file_version("soroban-ret-0.0"), None);
        assert_eq!(engine_file_version("soroban-ret-0.0.4.tmp"), None);
        assert_eq!(engine_file_version("soroban-ret-"), None);
        assert_eq!(engine_file_version("soroban-ret-0.0.a"), None);
        assert_eq!(engine_file_version("other-0.0.4"), None);
    }

    // ... builtin_version_matches_cargo_lock from Task 1 stays here ...
}
```

(Keep the Task 1 test inside this same module; just merge the `use` items.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `cargo test` (in `DevTools/soroban-ret-web`)
Expected: compile errors — `Registry::new` and `engine_file_version` don't exist yet.

- [ ] **Step 3: Implement the scan in `engine.rs`**

Replace the `Registry` struct and impl (keep `Engine`, `natural_version_cmp`, and the module doc — extend the doc with the engines-dir source):

```rust
pub struct Registry {
    pub builtin_version: String,
    clis: BTreeMap<String, PathBuf>,
    engines_dir: Option<PathBuf>,
}

impl Registry {
    /// Build the registry: the builtin library version, any CLI binaries
    /// configured via `DEVTOOLS_RET_BINARIES` that exist on disk, and an
    /// optional directory scanned for uploaded `soroban-ret-<version>`
    /// binaries (rescanned on every lookup, so uploads appear without a
    /// restart).
    pub fn from_env(builtin_version: &str, engines_dir: Option<PathBuf>) -> Self {
        let mut clis = BTreeMap::new();
        if let Ok(spec) = std::env::var("DEVTOOLS_RET_BINARIES") {
            for entry in spec.split(';') {
                let entry = entry.trim();
                if entry.is_empty() {
                    continue;
                }
                // Split on the first '=' only: Windows paths contain ':' and the
                // version is always the short left-hand side.
                if let Some((ver, path)) = entry.split_once('=') {
                    let ver = ver.trim().to_string();
                    let path = PathBuf::from(path.trim());
                    if ver == builtin_version {
                        log::warn!(
                            "DEVTOOLS_RET_BINARIES entry for {} shadows the builtin library; ignoring",
                            ver
                        );
                        continue;
                    }
                    if path.is_file() {
                        log::info!("Registered soroban-ret {} -> {}", ver, path.display());
                        clis.insert(ver, path);
                    } else {
                        log::warn!("soroban-ret binary for {} not found at {}", ver, path.display());
                    }
                } else {
                    log::warn!("Ignoring malformed DEVTOOLS_RET_BINARIES entry: {}", entry);
                }
            }
        }
        Self::new(builtin_version, clis, engines_dir)
    }

    fn new(
        builtin_version: &str,
        clis: BTreeMap<String, PathBuf>,
        engines_dir: Option<PathBuf>,
    ) -> Self {
        Self {
            builtin_version: builtin_version.to_string(),
            clis,
            engines_dir,
        }
    }

    /// Engines currently present in the scan directory. Called on every
    /// lookup — a readdir of a tiny directory is microseconds, and rescanning
    /// means a freshly uploaded binary shows up with no restart, no locks and
    /// no background tasks.
    fn scan_engines_dir(&self) -> BTreeMap<String, PathBuf> {
        let mut found = BTreeMap::new();
        let Some(dir) = &self.engines_dir else {
            return found;
        };
        let Ok(entries) = std::fs::read_dir(dir) else {
            return found;
        };
        for entry in entries.flatten() {
            let name = entry.file_name();
            let Some(name) = name.to_str() else { continue };
            let Some(ver) = engine_file_version(name) else { continue };
            if ver == self.builtin_version {
                continue;
            }
            let Ok(md) = entry.metadata() else { continue };
            if !md.is_file() || !is_executable(&md) {
                continue;
            }
            found.insert(ver.to_string(), entry.path());
        }
        found
    }

    /// All external CLI engines: scanned directory entries, with explicit
    /// `DEVTOOLS_RET_BINARIES` config overriding same-version dir files.
    fn cli_engines(&self) -> BTreeMap<String, PathBuf> {
        let mut map = self.scan_engines_dir();
        for (ver, path) in &self.clis {
            map.insert(ver.clone(), path.clone());
        }
        map
    }

    /// Available versions, newest first, with the builtin version always present.
    pub fn available(&self) -> Vec<String> {
        let mut versions: Vec<String> = self.cli_engines().into_keys().collect();
        if !versions.iter().any(|v| v == &self.builtin_version) {
            versions.push(self.builtin_version.clone());
        }
        versions.sort_by(|a, b| natural_version_cmp(b, a));
        versions
    }

    /// Resolve a requested version (None = builtin) to a concrete engine.
    pub fn resolve(&self, version: Option<&str>) -> Result<Engine, WebError> {
        match version {
            None => Ok(Engine::Builtin),
            Some(v) if v.is_empty() || v == self.builtin_version => Ok(Engine::Builtin),
            Some(v) => match self.cli_engines().remove(v) {
                Some(path) => Ok(Engine::Cli {
                    version: v.to_string(),
                    path,
                }),
                None => Err(WebError::InvalidInput(format!(
                    "Unknown soroban-ret version '{}'. Available: {}",
                    v,
                    self.available().join(", ")
                ))),
            },
        }
    }
}

/// `soroban-ret-<major>.<minor>.<patch>` -> the version, else None. Strict on
/// purpose: the scanner must never pick up `.tmp` upload staging files or
/// anything else that lands in the directory.
fn engine_file_version(name: &str) -> Option<&str> {
    let ver = name.strip_prefix("soroban-ret-")?;
    let parts: Vec<&str> = ver.split('.').collect();
    let ok = parts.len() == 3
        && parts
            .iter()
            .all(|p| !p.is_empty() && p.chars().all(|c| c.is_ascii_digit()));
    ok.then_some(ver)
}

#[cfg(unix)]
fn is_executable(md: &std::fs::Metadata) -> bool {
    use std::os::unix::fs::PermissionsExt;
    md.permissions().mode() & 0o111 != 0
}

#[cfg(not(unix))]
fn is_executable(_md: &std::fs::Metadata) -> bool {
    true // Windows local dev: no exec bit; the name convention is the filter.
}
```

- [ ] **Step 4: Wire the flag in `main.rs`**

Add to the `Cli` struct (after `no_compile`):

```rust
    /// Directory scanned for uploaded `soroban-ret-<version>` engine binaries
    /// (rescanned on every request; unset = disabled)
    #[arg(long, env = "DEVTOOLS_ENGINES_DIR")]
    engines_dir: Option<PathBuf>,
```

Replace the registry construction (`main.rs:165`):

```rust
    if let Some(dir) = &cli.engines_dir {
        log::info!("Scanning for engine binaries in {}", dir.display());
    }
    let registry = Registry::from_env(RET_VERSION, cli.engines_dir.clone());
    log::info!("soroban-ret versions available: {}", registry.available().join(", "));
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cargo test`
Expected: all tests pass (the `non_executable_files_are_ignored` test is unix-only and will be skipped on Windows — that's fine; CI/dev-cluster verification covers it).

- [ ] **Step 6: Commit**

```bash
git add DevTools/soroban-ret-web/src/engine.rs DevTools/soroban-ret-web/src/main.rs
git commit -m "Scan DEVTOOLS_ENGINES_DIR for uploaded soroban-ret engine binaries

The registry now has a third version source besides the builtin library and
DEVTOOLS_RET_BINARIES: a directory of soroban-ret-<version> binaries,
rescanned on every lookup so new uploads appear in the dropdown without a
restart. Strict name/executable filtering keeps staging files out."
```

---

### Task 3: Helm PVC + mounts, docker-compose volumes

**Files:**
- Create: `Deploy/helm/charts/sorobanretweb/templates/soroban-ret-engines-pvc.yaml`
- Modify: `Deploy/helm/charts/sorobanretweb/templates/soroban-ret-web.yaml` (env + volumeMounts + volumes)
- Modify: `Deploy/helm/values.yaml:35-43` (devtools block)
- Modify: `Backend/docker-compose.yml:75-104` (soroban-ret-web service + volumes)
- Modify: `DevTools/docker-compose.yml` (same service standalone)

**Interfaces:**
- Consumes: `DEVTOOLS_ENGINES_DIR` env understood by the service (Task 2).
- Produces: `/engines` PVC named `{{ .Values.global.environment.name }}-soroban-ret-engines` — the path and pod label (`app={{ .Values.global.environment.name }}-soroban-ret-web`) that Task 4's upload script relies on.

- [ ] **Step 1: Add values**

In `Deploy/helm/values.yaml`, inside `global.devtools` (after `noCompile: "true"`):

```yaml
    # Engine binaries uploaded by the devtools-engines workflow (kubectl cp
    # onto this PVC); the service rescans the directory on every request.
    engines:
      storageClassName: "local-path"
      storage: "1Gi"
```

- [ ] **Step 2: Create the PVC template**

`Deploy/helm/charts/sorobanretweb/templates/soroban-ret-engines-pvc.yaml`:

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  namespace: {{ .Values.global.environment.namespace }}
  name: "{{ .Values.global.environment.name }}-soroban-ret-engines"
  labels:
    app: "{{ .Values.global.app.name }}"
    env: "{{ .Values.global.environment.namespace }}"
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: "{{ .Values.global.devtools.engines.storageClassName }}"
  resources:
    requests:
      storage: "{{ .Values.global.devtools.engines.storage }}"
```

- [ ] **Step 3: Mount it in the Deployment**

In `Deploy/helm/charts/sorobanretweb/templates/soroban-ret-web.yaml`:

Add to the container `env` list (after `DEVTOOLS_NO_COMPILE`):

```yaml
            - name: DEVTOOLS_ENGINES_DIR
              value: "/engines"
```

Add to the container (after `imagePullPolicy`), and to the pod spec (same indent as `containers`):

```yaml
          volumeMounts:
            - name: engines
              mountPath: /engines
```

```yaml
      volumes:
        - name: engines
          persistentVolumeClaim:
            claimName: "{{ .Values.global.environment.name }}-soroban-ret-engines"
```

- [ ] **Step 4: Verify the chart renders**

Run: `helm template sorobansecurityportal Deploy/helm | Select-String -Pattern "soroban-ret-engines|DEVTOOLS_ENGINES_DIR|mountPath: /engines" -Context 0,1`
Expected: the PVC object, the env var, and the volumeMount all render; no template errors.

- [ ] **Step 5: Mirror in docker-compose**

`Backend/docker-compose.yml` — in the `soroban-ret-web` service add env and volume, and register the named volume:

```yaml
      - DEVTOOLS_ENGINES_DIR=/engines
```

```yaml
    volumes:
      - soroban-ret-engines-volume:/engines
```

and under the top-level `volumes:` key:

```yaml
  soroban-ret-engines-volume:
```

`DevTools/docker-compose.yml` — same three additions to its `soroban-ret-web` service (it has no top-level `volumes:` key yet; add one at the end of the file):

```yaml
volumes:
  soroban-ret-engines-volume:
```

- [ ] **Step 6: Validate compose files**

Run: `docker compose -f Backend/docker-compose.yml config --quiet; docker compose -f DevTools/docker-compose.yml config --quiet`
Expected: exit code 0, no output.

- [ ] **Step 7: Commit**

```bash
git add Deploy/helm/values.yaml Deploy/helm/charts/sorobanretweb/templates/ Backend/docker-compose.yml DevTools/docker-compose.yml
git commit -m "Mount an engines PVC/volume into soroban-ret-web

1Gi local-path PVC at /engines with DEVTOOLS_ENGINES_DIR pointing at it, in
both the Helm chart and the compose files. Uploaded engine binaries survive
pod restarts and appear in the version dropdown without a redeploy."
```

---

### Task 4: Upload script `DevTools/scripts/upload-engines.sh`

**Files:**
- Create: `DevTools/scripts/upload-engines.sh`

**Interfaces:**
- Consumes: crates.io API (`soroban-ret-cli` versions), kubectl context, pod label `app=$APP_LABEL`, `/engines` dir in the pod (Task 3), fixture `DevTools/soroban-ret-web/fixtures/test_add_u64.wasm` for the smoke test.
- Produces: `/engines/soroban-ret-<version>` executables in the pod (the exact names Task 2's scanner registers). Used verbatim by Task 5's workflow and runnable by hand against dev.

- [ ] **Step 1: Write the script**

```bash
#!/usr/bin/env bash
# Build missing soroban-ret CLI engine versions and upload them into the
# soroban-ret-web pod's /engines volume, where the service picks them up
# without a restart (see docs/superpowers/specs/2026-07-17-devtools-dynamic-engines-design.md).
#
# Requirements: kubectl (context pointing at the target cluster), curl, jq,
# and either a Linux host with cargo + the x86_64-unknown-linux-musl target
# (rustup target add x86_64-unknown-linux-musl; apt install musl-tools), or
# Docker (used automatically on non-Linux hosts).
#
# Env overrides:
#   NAMESPACE   k8s namespace            (default sorobansecurityportal-ns)
#   APP_LABEL   pod label selector value (default sorobansecurityportal-soroban-ret-web)
#   USE_DOCKER  1 = always build in Docker, 0 = never (default: auto by OS)
set -euo pipefail

NAMESPACE="${NAMESPACE:-sorobansecurityportal-ns}"
APP_LABEL="${APP_LABEL:-sorobansecurityportal-soroban-ret-web}"
TARGET="x86_64-unknown-linux-musl"
ENGINES_DIR="/engines"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FIXTURE_DIR="$SCRIPT_DIR/../soroban-ret-web/fixtures"

use_docker() {
  case "${USE_DOCKER:-auto}" in
    1) return 0 ;;
    0) return 1 ;;
    *) [ "$(uname -s)" != "Linux" ] ;;
  esac
}

# build_engine <version> <dest-file>: cargo-install the CLI as a static Linux
# binary and smoke-test it on a fixture contract before returning.
build_engine() {
  local v="$1" dest="$2"
  if use_docker; then
    # rust:alpine targets musl natively. No bind mounts (Git Bash on Windows
    # mangles them): the fixture goes in via stdin, the binary comes out via
    # docker cp. The smoke test runs inside the container because the
    # produced Linux binary can't run on a non-Linux host.
    local cname="ret-engine-build-$v-$$"
    docker run --name "$cname" -i rust:alpine sh -ec "
      cat > /tmp/fixture.wasm
      apk add -q musl-dev
      cargo install soroban-ret-cli --version $v --root /tmp/eng
      /tmp/eng/bin/soroban-ret /tmp/fixture.wasm > /dev/null" \
      < "$FIXTURE_DIR/test_add_u64.wasm"
    docker cp "$cname:/tmp/eng/bin/soroban-ret" "$dest"
    docker rm "$cname" > /dev/null
    chmod 0755 "$dest" 2>/dev/null || true
  else
    local root
    root="$(mktemp -d)"
    cargo install soroban-ret-cli --version "$v" --target "$TARGET" --root "$root"
    "$root/bin/soroban-ret" "$FIXTURE_DIR/test_add_u64.wasm" > /dev/null
    install -m 0755 "$root/bin/soroban-ret" "$dest"
    rm -rf "$root"
  fi
}

pod="$(kubectl -n "$NAMESPACE" get pod -l "app=$APP_LABEL" \
  -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)"
if [ -z "$pod" ]; then
  echo "ERROR: no pod with label app=$APP_LABEL in namespace $NAMESPACE" >&2
  exit 1
fi
echo "Target pod: $NAMESPACE/$pod"

versions="$(curl -fsSL https://crates.io/api/v1/crates/soroban-ret-cli \
  | jq -r '.versions[] | select(.yanked | not) | .num')"
echo "crates.io soroban-ret-cli versions:" $versions
existing="$(kubectl -n "$NAMESPACE" exec "$pod" -- ls "$ENGINES_DIR" 2>/dev/null || true)"

added=0 skipped=0
for v in $versions; do
  if printf '%s\n' "$existing" | grep -qx "soroban-ret-$v"; then
    echo "skip $v (already uploaded)"
    skipped=$((skipped + 1))
    continue
  fi
  work="$(mktemp -d)"
  echo "building soroban-ret-cli $v ($TARGET)..."
  build_engine "$v" "$work/soroban-ret-$v"
  echo "uploading soroban-ret-$v..."
  # Two-phase upload: the scanner ignores dotfiles, so a partially copied
  # binary can never be picked up; mv within the same filesystem is atomic.
  kubectl -n "$NAMESPACE" cp "$work/soroban-ret-$v" "$pod:$ENGINES_DIR/.soroban-ret-$v.tmp"
  kubectl -n "$NAMESPACE" exec "$pod" -- sh -ec \
    "chmod 0755 $ENGINES_DIR/.soroban-ret-$v.tmp && mv $ENGINES_DIR/.soroban-ret-$v.tmp $ENGINES_DIR/soroban-ret-$v"
  rm -rf "$work"
  added=$((added + 1))
done
echo "Done: $added uploaded, $skipped already present."
```

- [ ] **Step 2: Syntax-check and mark executable**

Run: `bash -n DevTools/scripts/upload-engines.sh`
Expected: no output, exit 0.

Run: `git add DevTools/scripts/upload-engines.sh; git update-index --chmod=+x DevTools/scripts/upload-engines.sh`
(Windows has no exec bit — set it in the git index so the workflow runner gets an executable file.)

- [ ] **Step 3: Commit**

```bash
git commit -m "Add upload-engines script: build soroban-ret CLIs and kubectl-cp them to the pod

Queries crates.io for non-yanked soroban-ret-cli versions, builds each
missing one as a static musl binary (in Docker on non-Linux hosts),
smoke-tests it on a fixture contract and uploads it atomically into the
/engines volume via a dotfile-staged mv."
```

---

### Task 5: Scheduled workflow `.github/workflows/devtools-engines.yml`

**Files:**
- Create: `.github/workflows/devtools-engines.yml`

**Interfaces:**
- Consumes: `DevTools/scripts/upload-engines.sh` (Task 4), `secrets.KUBECONFIG` (already used by `cd-prod.yml`).
- Produces: daily sync of prod's `/engines` with crates.io.

- [ ] **Step 1: Write the workflow**

```yaml
name: Sync Dev Tools engine versions

# Keeps the soroban-ret version dropdown on /dev-tools in sync with crates.io:
# builds any newly published soroban-ret-cli version as a static musl binary
# on the runner and uploads it into the soroban-ret-web pod's /engines PVC.
# No portal rebuild or redeploy involved.

on:
  schedule:
    - cron: '17 3 * * *'
  workflow_dispatch:

jobs:
  sync-engines:
    runs-on: ubuntu-latest
    permissions:
      contents: read

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4.1.3

      - name: Install musl build tools
        run: |
          sudo apt-get update
          sudo apt-get install -y --no-install-recommends musl-tools jq
          rustup target add x86_64-unknown-linux-musl

      - name: Write kubeconfig from secret
        run: |
          mkdir -p $HOME/.kube
          echo "${{ secrets.KUBECONFIG }}" > $HOME/.kube/config

      - name: Build and upload missing engines
        run: bash DevTools/scripts/upload-engines.sh
```

- [ ] **Step 2: Lint the workflow**

Run: `Get-Content .github/workflows/devtools-engines.yml | docker run --rm -i mikefarah/yq eval '.' -` (or any YAML parse). Expected: parses cleanly.
(If `actionlint` is available: `actionlint .github/workflows/devtools-engines.yml` — expected: no findings.)

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/devtools-engines.yml
git commit -m "Add a daily workflow syncing Dev Tools engine versions from crates.io"
```

---

### Task 6: Documentation

**Files:**
- Modify: `DevTools/README.md` ("Version selection" section + deployment notes)

**Interfaces:** none (docs only).

- [ ] **Step 1: Extend the "Version selection" section**

In `DevTools/README.md`, after the existing `DEVTOOLS_RET_BINARIES` paragraph (ends "…real on-chain contracts recover best."), add:

```markdown
Versions can also be provided as binaries in a scanned directory
(`--engines-dir` / `DEVTOOLS_ENGINES_DIR`, unset by default). Files named
`soroban-ret-<version>` (strict `x.y.z`, executable) are registered as CLI
engines; the directory is rescanned on every lookup, so a newly added binary
appears in the dropdown immediately — no restart. Dotfiles/`.tmp` staging
files and foreign names are ignored; an explicit `DEVTOOLS_RET_BINARIES`
entry wins over a same-version dir file, and the builtin version always wins
over both.

In Kubernetes this directory is a 1Gi PVC mounted at `/engines`. The
`devtools-engines` GitHub workflow (daily + manual dispatch) checks crates.io
for new `soroban-ret-cli` releases, builds each missing version as a static
musl binary on the runner, smoke-tests it and uploads it atomically with
`kubectl cp` — so new crate releases show up on `/dev-tools` without any
portal rebuild or redeploy. The same logic can be run by hand against any
cluster (e.g. dev) via:

​```bash
NAMESPACE=sorobansecurityportal-ns bash DevTools/scripts/upload-engines.sh
​```

(On non-Linux hosts the build runs inside a `rust:alpine` container
automatically.) The builtin library version itself is derived from
`Cargo.lock` at build time (`build.rs`), so bumping the `soroban-ret`
dependency in `Cargo.toml` is the single source of truth for it.
```

(Remove the zero-width characters before the inner code fence when pasting — they are only there to survive this plan's own fencing.)

Also update the flag table (after the `DEVTOOLS_RET_BINARIES` row):

```markdown
| `--engines-dir` / `DEVTOOLS_ENGINES_DIR` | (unset) — directory scanned for `soroban-ret-<version>` engine binaries |
```

- [ ] **Step 2: Commit**

```bash
git add DevTools/README.md
git commit -m "Document dynamic engine versions in the Dev Tools README"
```

---

### Task 7: Local end-to-end check (docker compose)

Proves the whole loop — build binary → drop into volume → appears in dropdown without restart — without touching a cluster.

**Files:** none created (verification only).

**Interfaces:**
- Consumes: everything from Tasks 1–4.

- [ ] **Step 1: Build and start the slim service with the engines volume**

```bash
docker build --target runtime-slim -t soroban-ret-web:enginestest DevTools/soroban-ret-web
docker volume create ret-engines-test
docker run -d --name ret-engines-test -p 18787:8787 \
  -e DEVTOOLS_ENGINES_DIR=/engines -v ret-engines-test:/engines \
  soroban-ret-web:enginestest
```

- [ ] **Step 2: Baseline `/versions`**

Run: `curl -s http://localhost:18787/api/dev-tools/versions`
Expected: `{"current":"0.0.3","available":["0.0.3"],"compile_enabled":false}` — proves Task 1 (current is 0.0.3, not 0.0.2).

- [ ] **Step 3: Build one engine into the volume (no restart)**

```bash
MSYS_NO_PATHCONV=1 docker run --rm -v ret-engines-test:/out \
  rust:alpine sh -ec "
    apk add -q musl-dev
    cargo install soroban-ret-cli --version 0.0.2 --root /tmp/eng
    install -m 0755 /tmp/eng/bin/soroban-ret /out/soroban-ret-0.0.2"
```

- [ ] **Step 4: Verify dynamic registration and disassembly**

Run: `curl -s http://localhost:18787/api/dev-tools/versions`
Expected: `available` now `["0.0.3","0.0.2"]` — with no container restart.

Run (uses a committed fixture through the new engine):

```bash
curl -s -X POST http://localhost:18787/api/dev-tools/disassemble/fixture \
  -H "Content-Type: application/json" \
  -d '{"name":"test_add_u64","version":"0.0.2"}' | jq '{engine, engine_version, ok: (.source | length > 0)}'
```

Expected: `engine: "cli"`, `engine_version: "0.0.2"`, `ok: true`.
(If the fixture list uses different names, first run `curl -s http://localhost:18787/api/dev-tools/fixtures | jq '.fixtures[].name'` and pick one.)

- [ ] **Step 5: Clean up**

```bash
docker rm -f ret-engines-test
docker volume rm ret-engines-test
```

- [ ] **Step 6: Commit any fixes found**

If steps 2–4 surfaced bugs, fix them (with tests where applicable) and commit before proceeding.

---

### Task 8: Deploy to dev and verify in the cluster

**Files:** none (deployment/verification).

**Interfaces:**
- Consumes: the dev K3S cluster (local kubeconfig, namespace `sorobansecurityportal-ns`), Docker Hub `andreykerchin/*`, the upload script.

- [ ] **Step 1: Build and push the image**

```bash
docker build -t andreykerchin/soroban-ret-web:engines1 DevTools/soroban-ret-web --build-arg PREWARM=false
docker push andreykerchin/soroban-ret-web:engines1
```

- [ ] **Step 2: Upgrade the chart (new PVC/mount) on dev**

`--reuse-values` does NOT pick up new chart defaults, so pass the new keys explicitly:

```bash
helm upgrade sorobansecurityportal Deploy/helm -n sorobansecurityportal-ns --reuse-values \
  --set global.devtools.engines.storageClassName=local-path \
  --set global.devtools.engines.storage=1Gi \
  --set-string global.app.build=engines1
```

- [ ] **Step 3: Point the retweb deployment at the new image**

The shared `service.tag` drives all portal images; overriding just this deployment avoids rebuilding api/ui/worker:

```bash
kubectl -n sorobansecurityportal-ns set image deployment/sorobansecurityportal-soroban-ret-web \
  sorobansecurityportal-soroban-ret-web=andreykerchin/soroban-ret-web:engines1
kubectl -n sorobansecurityportal-ns rollout status deployment/sorobansecurityportal-soroban-ret-web
```

- [ ] **Step 4: Run the upload script against dev**

```bash
bash DevTools/scripts/upload-engines.sh
```

Expected: builds 0.0.1 and 0.0.2 (0.0.3 is the builtin — uploaded too, but shadowed and harmless; if desired later, the script could skip the builtin, YAGNI for now), uploads them, "Done: N uploaded".

- [ ] **Step 5: Verify live**

```bash
curl -s https://sorobanshield.ru/devtools/api/dev-tools/versions
```

Expected: `{"current":"0.0.3","available":["0.0.3","0.0.2","0.0.1"],...}`.

Then open `https://sorobanshield.ru/dev-tools` (Playwright), select version 0.0.2 in the dropdown, disassemble a Sample, and confirm the output panel reports engine `cli 0.0.2`. Re-run the script a second time — expected: all versions "skip (already uploaded)".

- [ ] **Step 6: Restart-persistence check**

```bash
kubectl -n sorobansecurityportal-ns rollout restart deployment/sorobansecurityportal-soroban-ret-web
kubectl -n sorobansecurityportal-ns rollout status deployment/sorobansecurityportal-soroban-ret-web
curl -s https://sorobanshield.ru/devtools/api/dev-tools/versions
```

Expected: versions list unchanged (PVC survived the restart).

---

## Post-plan

After all tasks pass: push the branch, open a PR (screenshots of the dropdown per the user's PR style), and after merge dispatch the `Sync Dev Tools engine versions` workflow once against prod. Prod also needs the same `--set global.devtools.engines.*` note if deployed with `--reuse-values` (cd-prod.yml passes explicit values, so a normal prod deploy is fine).

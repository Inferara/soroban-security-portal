//! soroban-ret engine selection.
//!
//! The service always ships one **builtin** engine: the `soroban-ret` library it
//! is compiled against (in-process, richest output). Operators can register
//! additional versions as external `soroban-ret` CLI binaries via
//! `DEVTOOLS_RET_BINARIES`, e.g.
//!
//! ```text
//! DEVTOOLS_RET_BINARIES="0.0.1=C:\engines\0.0.1\bin\soroban-ret.exe;0.0.3=/usr/bin/soroban-ret"
//! ```
//!
//! The UI version dropdown lists exactly the versions resolvable here, and the
//! selected version is honored end-to-end (a CLI engine is shelled out to for
//! the decompiled Rust; WAT / hex / section views are produced locally and are
//! version-independent).
//!
//! A third source is an optional directory (`DEVTOOLS_ENGINES_DIR`) scanned for
//! `soroban-ret-<version>` binaries on every lookup, so binaries uploaded into
//! a Kubernetes PVC appear in the dropdown without a restart.

use crate::error::WebError;
use std::collections::BTreeMap;
use std::path::PathBuf;

#[derive(Clone)]
pub enum Engine {
    /// In-process `soroban-ret` library this binary is linked against.
    Builtin,
    /// An external `soroban-ret` CLI binary at the given version.
    Cli { version: String, path: PathBuf },
}

impl Engine {
    pub fn version(&self, builtin: &str) -> String {
        match self {
            Engine::Builtin => builtin.to_string(),
            Engine::Cli { version, .. } => version.clone(),
        }
    }

    pub fn kind(&self) -> &'static str {
        match self {
            Engine::Builtin => "library",
            Engine::Cli { .. } => "cli",
        }
    }
}

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

/// Compare dotted versions numerically (so "0.0.10" > "0.0.2").
fn natural_version_cmp(a: &str, b: &str) -> std::cmp::Ordering {
    let parse = |s: &str| -> Vec<u64> {
        s.split(|c: char| c == '.' || c == '-')
            .map(|p| p.parse::<u64>().unwrap_or(0))
            .collect()
    };
    parse(a).cmp(&parse(b))
}

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

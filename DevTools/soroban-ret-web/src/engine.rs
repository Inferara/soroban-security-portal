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
}

impl Registry {
    /// Build the registry: the builtin library version plus any CLI binaries
    /// configured via `DEVTOOLS_RET_BINARIES` that actually exist on disk.
    pub fn from_env(builtin_version: &str) -> Self {
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
        Self {
            builtin_version: builtin_version.to_string(),
            clis,
        }
    }

    /// Available versions, newest first, with the builtin version always present.
    pub fn available(&self) -> Vec<String> {
        let mut versions: Vec<String> = self.clis.keys().cloned().collect();
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
            Some(v) => match self.clis.get(v) {
                Some(path) => Ok(Engine::Cli {
                    version: v.to_string(),
                    path: path.clone(),
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

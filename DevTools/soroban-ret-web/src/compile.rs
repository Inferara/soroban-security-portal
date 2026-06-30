//! Compile user-supplied Rust into a Soroban WASM contract, then disassemble it
//! with soroban-ret. Mirrors the issue's "Rust -> WASM (via stellar CLI) ->
//! disassemble" flow.
//!
//! The build runs against a persistent skeleton Cargo project (created once at
//! startup and pre-warmed so the soroban-sdk dependency graph is already
//! compiled). Requests are serialized on a mutex because they share that
//! project's `src/lib.rs`.

use crate::disasm::{self, DisassembleResponse};
use crate::engine::Engine;
use crate::error::WebError;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};
use tokio::sync::Mutex;

const BUILD_TIMEOUT: Duration = Duration::from_secs(300);
const CRATE_NAME: &str = "devtools_contract";

#[derive(Deserialize)]
pub struct CompileRequest {
    pub source: String,
    #[serde(default)]
    pub spec_only: bool,
    /// soroban-ret version to disassemble the produced WASM with (None = builtin).
    #[serde(default)]
    pub version: Option<String>,
}

#[derive(Serialize)]
pub struct CompileDiagnostic {
    pub level: String,
    pub message: String,
    pub code: Option<String>,
    pub line: Option<usize>,
    pub column: Option<usize>,
    pub end_line: Option<usize>,
    pub end_column: Option<usize>,
    pub children: Vec<CompileDiagnostic>,
}

#[derive(Serialize)]
pub struct CompileResponse {
    pub success: bool,
    pub diagnostics: Vec<CompileDiagnostic>,
    pub error_count: usize,
    pub warning_count: usize,
    pub elapsed_ms: u64,
    /// The toolchain used for the build ("stellar" or "cargo").
    pub builder: String,
    /// Disassembly of the produced WASM. Present only on a successful build.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<DisassembleResponse>,
}

/// Owns the skeleton project directory and serializes builds.
pub struct CompileEnv {
    pub dir: PathBuf,
    pub sdk_version: String,
    /// Explicit `stellar` binary to use for `stellar contract build`. When set
    /// (and present) it is preferred over `cargo`, per the issue requirement.
    pub stellar_bin: Option<PathBuf>,
    pub lock: Mutex<()>,
}

impl CompileEnv {
    /// Create (and pre-warm) the skeleton Cargo project. Returns `None` if the
    /// wasm32 target or the skeleton can't be set up, in which case the
    /// `/compile` endpoint reports "not configured" rather than failing builds.
    pub async fn init(dir: PathBuf, sdk_version: String, stellar_bin: Option<PathBuf>) -> Option<Self> {
        if let Err(e) = scaffold(&dir, &sdk_version).await {
            log::warn!("Compile env scaffold failed at {}: {}", dir.display(), e);
            return None;
        }
        let builder = resolve_stellar(stellar_bin.as_deref());
        log::info!(
            "Compile env ready at {} (soroban-sdk {}, builder: {})",
            dir.display(),
            sdk_version,
            builder
                .as_ref()
                .map(|p| format!("stellar @ {}", p.display()))
                .unwrap_or_else(|| "cargo".to_string())
        );
        Some(Self {
            dir,
            sdk_version,
            stellar_bin: builder,
            lock: Mutex::new(()),
        })
    }

    /// Pre-warm the dependency graph by building the placeholder contract once.
    /// Runs in the background; the first user build just reuses the cache.
    /// Returns whether the warm build succeeded (a failed SDK build means
    /// `/compile` should report itself unavailable rather than erroring per call).
    pub async fn warm(&self) -> bool {
        let _guard = self.lock.lock().await;
        log::info!(
            "Pre-warming compile cache for soroban-sdk {} (this may take a few minutes)...",
            self.sdk_version
        );
        match build(&self.dir, self.stellar_bin.as_deref()).await {
            Ok((ok, builder)) => {
                log::info!("Compile cache warmed (success={}, via {})", ok, builder);
                ok
            }
            Err(e) => {
                log::warn!("Compile cache warm failed: {}", e);
                false
            }
        }
    }
}

/// Resolve the `stellar` binary to use: an explicit path if it exists, else
/// `stellar` from PATH, else None (fall back to plain cargo).
fn resolve_stellar(explicit: Option<&Path>) -> Option<PathBuf> {
    if let Some(p) = explicit {
        if p.is_file() {
            return Some(p.to_path_buf());
        }
        log::warn!("Configured stellar binary not found at {}", p.display());
    }
    if which("stellar") {
        return Some(PathBuf::from("stellar"));
    }
    None
}

async fn scaffold(dir: &Path, sdk_version: &str) -> std::io::Result<()> {
    tokio::fs::create_dir_all(dir.join("src")).await?;
    let cargo_toml = format!(
        r#"[package]
name = "{CRATE_NAME}"
version = "0.0.0"
edition = "2021"
publish = false

[lib]
crate-type = ["cdylib", "rlib"]

[dependencies]
soroban-sdk = "{sdk_version}"

[profile.release]
opt-level = "z"
overflow-checks = true
debug = 0
strip = "symbols"
debug-assertions = false
panic = "abort"
codegen-units = 1
lto = true
"#
    );
    tokio::fs::write(dir.join("Cargo.toml"), cargo_toml).await?;
    // Minimal valid placeholder so the pre-warm build succeeds.
    let placeholder = r#"#![no_std]
use soroban_sdk::{contract, contractimpl, Env};

#[contract]
pub struct Contract;

#[contractimpl]
impl Contract {
    pub fn hello(_env: Env) -> u32 {
        0
    }
}
"#;
    tokio::fs::write(dir.join("src/lib.rs"), placeholder).await?;
    Ok(())
}

/// Run the build, preferring the `stellar` CLI (as the issue specifies) and
/// falling back to plain `cargo` with the wasm32 target. Returns
/// `(success, builder_name)` along with captured stdout/stderr via the closure.
async fn build(dir: &Path, stellar: Option<&Path>) -> std::io::Result<(bool, String)> {
    let (ok, _stdout, _stderr, builder) = build_capture(dir, stellar).await?;
    Ok((ok, builder))
}

async fn build_capture(
    dir: &Path,
    stellar: Option<&Path>,
) -> std::io::Result<(bool, String, String, String)> {
    if let Some(stellar) = stellar {
        // `stellar contract build` compiles the cdylib crate for the wasm32
        // target and copies the result into --out-dir. It doesn't expose cargo's
        // JSON message format, so on failure we fall back to its human stderr
        // (handled by the synthetic diagnostic in run_compile). `--optimize
        // false` avoids requiring the CLI's optional `additional-libs` feature.
        let output = tokio::time::timeout(
            BUILD_TIMEOUT,
            tokio::process::Command::new(stellar)
                .args(["contract", "build", "--out-dir", "out", "--optimize", "false"])
                .current_dir(dir)
                .kill_on_drop(true)
                .output(),
        )
        .await
        .map_err(|_| std::io::Error::new(std::io::ErrorKind::TimedOut, "stellar build timed out"))??;
        return Ok((
            output.status.success(),
            String::from_utf8_lossy(&output.stdout).into_owned(),
            String::from_utf8_lossy(&output.stderr).into_owned(),
            "stellar".to_string(),
        ));
    }

    let output = tokio::time::timeout(
        BUILD_TIMEOUT,
        tokio::process::Command::new("cargo")
            .args([
                "build",
                "--target",
                "wasm32-unknown-unknown",
                "--release",
                "--message-format=json",
            ])
            .current_dir(dir)
            .kill_on_drop(true)
            .output(),
    )
    .await
    .map_err(|_| std::io::Error::new(std::io::ErrorKind::TimedOut, "cargo build timed out"))??;

    Ok((
        output.status.success(),
        String::from_utf8_lossy(&output.stdout).into_owned(),
        String::from_utf8_lossy(&output.stderr).into_owned(),
        "cargo".to_string(),
    ))
}

/// Run `cargo check` purely to recover precise JSON diagnostics. Used when the
/// primary builder (e.g. `stellar contract build`) fails without emitting
/// cargo's machine-readable diagnostics. We check against the *same* target the
/// build used so the dependency graph is already warm (otherwise the first such
/// failure would compile the whole SDK for a second target).
async fn cargo_check_diagnostics(dir: &Path, target: &str) -> std::io::Result<Vec<CompileDiagnostic>> {
    let output = tokio::time::timeout(
        Duration::from_secs(120),
        tokio::process::Command::new("cargo")
            .args(["check", "--target", target, "--message-format=json"])
            .current_dir(dir)
            .kill_on_drop(true)
            .output(),
    )
    .await
    .map_err(|_| std::io::Error::new(std::io::ErrorKind::TimedOut, "cargo check timed out"))??;
    Ok(parse_cargo_diagnostics(&String::from_utf8_lossy(&output.stdout)))
}

/// Locate the produced WASM artifact under the skeleton's target dir.
async fn find_wasm(dir: &Path) -> Option<PathBuf> {
    // stellar contract build writes to ./out, cargo to target/wasm32-.../release
    let candidates = [
        dir.join("out").join(format!("{CRATE_NAME}.wasm")),
        dir.join("target/wasm32-unknown-unknown/release")
            .join(format!("{CRATE_NAME}.wasm")),
    ];
    for c in candidates {
        if tokio::fs::try_exists(&c).await.unwrap_or(false) {
            return Some(c);
        }
    }
    None
}

/// Best-effort speed bump (NOT a security boundary): reject source that uses
/// compile-time macros able to read server files or the environment. Cargo would
/// embed the read bytes into the WASM data section, which we hand back to the
/// caller — a file/secret exfiltration vector.
///
/// The file readers are matched as bare identifiers too, so the obvious
/// `macro_rules! { ($m:ident) => { $m!(..) } }` indirection is also caught. This
/// can still be defeated (e.g. `env!` cannot be matched bare without colliding
/// with the ubiquitous `Env`/`env`), so it does not replace the real fix:
/// compile must be off by default and, when enabled, run in a sandbox with a
/// read-only/empty-root filesystem and no network.
fn check_forbidden_macros(source: &str) -> Result<(), WebError> {
    // Bare names (catch both `include_str!(..)` and the `$m:ident` indirection).
    const FORBIDDEN_BARE: &[&str] = &["include_str", "include_bytes", "option_env"];
    // Names that collide with normal code as bare idents — match the invocation.
    const FORBIDDEN_CALL: &[&str] = &["env!", "include!"];
    let hit = FORBIDDEN_BARE
        .iter()
        .chain(FORBIDDEN_CALL.iter())
        .find(|m| source.contains(**m));
    if let Some(m) = hit {
        return Err(WebError::InvalidInput(format!(
            "The `{}` macro is not allowed: it can read server files or environment variables at compile time.",
            m.trim_end_matches('!')
        )));
    }
    Ok(())
}

pub async fn run_compile(
    env: &CompileEnv,
    req: CompileRequest,
    engine: Engine,
    builtin_version: &str,
) -> Result<CompileResponse, WebError> {
    check_forbidden_macros(&req.source)?;
    let start = Instant::now();

    // Serialize: the skeleton project's src/lib.rs is shared across requests.
    let _guard = env.lock.lock().await;

    let lib_path = env.dir.join("src/lib.rs");
    tokio::fs::write(&lib_path, &req.source)
        .await
        .map_err(|e| WebError::CompileError(format!("Failed to write source: {}", e)))?;
    // Remove any stale artifact so a failed build can't be mistaken for success.
    if let Some(prev) = find_wasm(&env.dir).await {
        let _ = tokio::fs::remove_file(prev).await;
    }

    let (success, stdout, stderr, builder) = build_capture(&env.dir, env.stellar_bin.as_deref())
        .await
        .map_err(|e| WebError::CompileError(format!("Build failed to run: {}", e)))?;

    let diagnostics = parse_cargo_diagnostics(&stdout);
    let error_count = diagnostics.iter().filter(|d| d.level == "error").count();
    let warning_count = diagnostics.iter().filter(|d| d.level == "warning").count();

    if !success {
        let mut diags = diagnostics;
        // The builder may not emit cargo's JSON diagnostics (notably
        // `stellar contract build`). If we have no precise errors, recover them
        // with a fast `cargo check`.
        let has_precise = diags.iter().any(|d| d.level == "error" && d.line.is_some());
        if !has_precise {
            // Check with the same target the build used, so its deps are warm.
            let check_target = if env.stellar_bin.is_some() {
                "wasm32v1-none"
            } else {
                "wasm32-unknown-unknown"
            };
            if let Ok(check) = cargo_check_diagnostics(&env.dir, check_target).await {
                if check.iter().any(|d| d.level == "error") {
                    diags = check;
                }
            }
        }
        // Last resort: surface the raw stderr so the UI always shows something.
        if diags.iter().all(|d| d.level != "error") {
            diags.push(CompileDiagnostic {
                level: "error".to_string(),
                message: tail(&stderr, 4000),
                code: None,
                line: None,
                column: None,
                end_line: None,
                end_column: None,
                children: Vec::new(),
            });
        }
        let error_count = diags.iter().filter(|d| d.level == "error").count();
        let warning_count = diags.iter().filter(|d| d.level == "warning").count();
        return Ok(CompileResponse {
            success: false,
            diagnostics: diags,
            error_count,
            warning_count,
            elapsed_ms: start.elapsed().as_millis() as u64,
            builder,
            result: None,
        });
    }

    let wasm_path = find_wasm(&env.dir)
        .await
        .ok_or_else(|| WebError::CompileError("Build succeeded but no WASM artifact found".into()))?;
    let wasm = tokio::fs::read(&wasm_path)
        .await
        .map_err(|e| WebError::CompileError(format!("Failed to read WASM artifact: {}", e)))?;

    let disasm = disasm::disassemble(wasm, req.spec_only, None, engine, builtin_version).await?;

    Ok(CompileResponse {
        success: true,
        diagnostics,
        error_count,
        warning_count,
        elapsed_ms: start.elapsed().as_millis() as u64,
        builder,
        result: Some(disasm),
    })
}

fn tail(s: &str, max: usize) -> String {
    if s.len() <= max {
        return s.to_string();
    }
    // Walk forward from the raw byte offset to the next char boundary so the
    // slice never cuts through a multi-byte UTF-8 sequence (cargo stderr can
    // echo the user's source, which may contain unicode).
    let raw = s.len() - max;
    let start = (raw..=s.len()).find(|&i| s.is_char_boundary(i)).unwrap_or(s.len());
    format!("...{}", &s[start..])
}

#[cfg(test)]
mod tests {
    use super::{check_forbidden_macros, tail};

    #[test]
    fn rejects_compile_time_file_and_env_macros() {
        assert!(check_forbidden_macros(r#"const X: &str = include_str!("/proc/self/environ");"#).is_err());
        assert!(check_forbidden_macros(r#"const X: &[u8] = include_bytes!("/run/secrets/token");"#).is_err());
        assert!(check_forbidden_macros(r#"const X: &str = env!("SECRET");"#).is_err());
        // The macro_rules! `$m:ident` indirection for file readers is caught too.
        assert!(check_forbidden_macros(
            r#"macro_rules! c { ($m:ident,$p:expr) => { $m!($p) }; } const X: &str = c!(include_str, "/x");"#
        )
        .is_err());
        // Normal Soroban code that uses the `Env` type / `env` binding is fine.
        assert!(check_forbidden_macros("pub fn add(env: soroban_sdk::Env, a: u64) -> u64 { let _ = env; a }").is_ok());
    }

    #[test]
    fn tail_never_splits_a_multibyte_char() {
        // 🦀 is 4 bytes; cut at every offset that would land mid-emoji.
        let s = format!("{}🦀tail", "x".repeat(10));
        for max in 1..=12 {
            let _ = tail(&s, max); // must not panic
        }
        assert!(tail(&s, 4).starts_with("..."));
        assert!(tail("short", 100) == "short");
    }
}

fn which(bin: &str) -> bool {
    let path = match std::env::var_os("PATH") {
        Some(p) => p,
        None => return false,
    };
    let exts = if cfg!(windows) {
        vec!["", ".exe", ".cmd", ".bat"]
    } else {
        vec![""]
    };
    std::env::split_paths(&path).any(|dir| {
        exts.iter()
            .any(|ext| dir.join(format!("{bin}{ext}")).is_file())
    })
}

// --- cargo JSON diagnostic parsing (ported from the soroban-decompiler web backend) ---

fn parse_cargo_diagnostics(stdout: &str) -> Vec<CompileDiagnostic> {
    let mut diagnostics = Vec::new();
    for line in stdout.lines() {
        let Ok(value) = serde_json::from_str::<serde_json::Value>(line) else {
            continue;
        };
        if value.get("reason").and_then(|r| r.as_str()) != Some("compiler-message") {
            continue;
        }
        let Some(message) = value.get("message") else {
            continue;
        };
        if let Some(diag) = parse_message(message) {
            diagnostics.push(diag);
        }
    }
    diagnostics
}

fn parse_message(message: &serde_json::Value) -> Option<CompileDiagnostic> {
    let level = message.get("level")?.as_str()?;
    if level == "failure-note" {
        return None;
    }
    let msg_text = message.get("message")?.as_str()?.to_string();
    if msg_text.starts_with("aborting due to") || msg_text.starts_with("could not compile") {
        return None;
    }

    let code = message
        .get("code")
        .and_then(|c| c.get("code"))
        .and_then(|c| c.as_str())
        .map(|s| s.to_string());

    // Match the user's source file. cargo reports the path with the platform
    // separator, so it's `src/lib.rs` on Unix but `src\lib.rs` on Windows —
    // normalize before comparing.
    let is_user_file = |span: &serde_json::Value| -> bool {
        span.get("file_name")
            .and_then(|f| f.as_str())
            .map(|f| f.replace('\\', "/"))
            .as_deref()
            == Some("src/lib.rs")
    };

    let spans = message.get("spans").and_then(|s| s.as_array());
    let primary_span = spans.and_then(|spans| {
        spans.iter().find(|span| {
            let is_primary = span.get("is_primary").and_then(|p| p.as_bool());
            is_user_file(span) && is_primary == Some(true)
        })
    });
    let span = primary_span.or_else(|| spans.and_then(|spans| spans.iter().find(|s| is_user_file(s))));

    let (line, column, end_line, end_column) = if let Some(span) = span {
        (
            span.get("line_start").and_then(|v| v.as_u64()).map(|v| v as usize),
            span.get("column_start").and_then(|v| v.as_u64()).map(|v| v as usize),
            span.get("line_end").and_then(|v| v.as_u64()).map(|v| v as usize),
            span.get("column_end").and_then(|v| v.as_u64()).map(|v| v as usize),
        )
    } else {
        (None, None, None, None)
    };

    if span.is_none() && (level == "error" || level == "warning") {
        let has_any_spans = spans.is_some_and(|s| !s.is_empty());
        if has_any_spans {
            return None;
        }
    }

    let children = message
        .get("children")
        .and_then(|c| c.as_array())
        .map(|children| children.iter().filter_map(parse_message).collect::<Vec<_>>())
        .unwrap_or_default();

    Some(CompileDiagnostic {
        level: level.to_string(),
        message: msg_text,
        code,
        line,
        column,
        end_line,
        end_column,
        children,
    })
}

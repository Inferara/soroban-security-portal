//! Dev Tools backend for the Soroban Security Portal.
//!
//! JSON API consumed by the portal's "Dev Tools" page:
//!   GET  /api/dev-tools/health
//!   GET  /api/dev-tools/versions            -> available soroban-ret versions
//!   GET  /api/dev-tools/fixtures            -> built-in sample contracts
//!   POST /api/dev-tools/disassemble         -> { wasm_base64 } -> Rust + WAT + WASM
//!   POST /api/dev-tools/disassemble/upload  -> multipart wasm upload
//!   POST /api/dev-tools/disassemble/fixture -> { name } sample contract
//!   POST /api/dev-tools/address             -> { address, network } fetch + disassemble
//!   POST /api/dev-tools/compile             -> { source } compile Rust -> WASM -> disassemble
//!
//! Every disassembly accepts an optional `version` selecting the soroban-ret
//! engine (see `engine.rs`).

mod compile;
mod disasm;
mod engine;
mod error;
mod fixtures;
mod rpc;

use axum::extract::{DefaultBodyLimit, Multipart, State};
use axum::http::{HeaderValue, StatusCode};
use axum::routing::{get, post};
use axum::{Json, Router};
use base64::Engine as _;
use clap::Parser;
use compile::{CompileEnv, CompileRequest, CompileResponse};
use disasm::DisassembleResponse;
use engine::Registry;
use error::WebError;
use fixtures::FixtureListResponse;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tower_http::cors::{AllowOrigin, Any, CorsLayer};

/// soroban-ret library version this service is built against.
const RET_VERSION: &str = "0.0.2";

#[derive(Parser)]
#[command(name = "soroban-ret-web")]
#[command(about = "Dev Tools backend (compile + disassemble) for the Soroban Security Portal")]
struct Cli {
    #[arg(short, long, env = "DEVTOOLS_PORT", default_value = "8787")]
    port: u16,

    #[arg(short, long, env = "DEVTOOLS_BIND", default_value = "127.0.0.1")]
    bind: String,

    #[arg(
        long,
        env = "DEVTOOLS_MAINNET_RPC",
        default_value = "https://soroban-rpc.mainnet.stellar.gateway.fm"
    )]
    mainnet_rpc: String,

    #[arg(
        long,
        env = "DEVTOOLS_TESTNET_RPC",
        default_value = "https://soroban-testnet.stellar.org"
    )]
    testnet_rpc: String,

    /// Max upload / request body size in bytes (default 5MB)
    #[arg(long, env = "DEVTOOLS_MAX_UPLOAD", default_value = "5242880")]
    max_upload: usize,

    /// soroban-sdk version used for the compile skeleton project
    #[arg(long, env = "DEVTOOLS_SOROBAN_SDK_VERSION", default_value = "22.0.8")]
    soroban_sdk_version: String,

    /// Directory for the compile skeleton Cargo project (defaults to a temp dir)
    #[arg(long, env = "DEVTOOLS_COMPILE_DIR")]
    compile_dir: Option<PathBuf>,

    /// Path to the `stellar` CLI used for `stellar contract build`. Falls back to
    /// `stellar` on PATH, then to plain `cargo`.
    #[arg(long, env = "DEVTOOLS_STELLAR_BIN")]
    stellar_bin: Option<PathBuf>,

    /// Disable the compile endpoint entirely (skips skeleton scaffold + warm)
    #[arg(long, env = "DEVTOOLS_NO_COMPILE", default_value = "false")]
    no_compile: bool,
}

struct AppState {
    mainnet_rpc: String,
    testnet_rpc: String,
    http_client: reqwest::Client,
    compile_env: Option<CompileEnv>,
    registry: Registry,
    /// Set once the compile cache pre-warm finishes (always considered done when
    /// compilation is disabled). Drives the `/ready` probe.
    warm_done: Arc<AtomicBool>,
    /// Whether the pre-warm build actually succeeded. A failed SDK build disables
    /// `/compile` cleanly instead of erroring on every request.
    warm_ok: Arc<AtomicBool>,
}

#[derive(Serialize)]
struct VersionsResponse {
    current: String,
    available: Vec<String>,
    compile_enabled: bool,
}

#[derive(Deserialize)]
struct DisassembleRequest {
    #[serde(default)]
    wasm_base64: Option<String>,
    #[serde(default)]
    wasm_hex: Option<String>,
    #[serde(default)]
    spec_only: bool,
    #[serde(default)]
    version: Option<String>,
}

#[derive(Deserialize)]
struct AddressRequest {
    address: String,
    #[serde(default = "default_network")]
    network: String,
    #[serde(default)]
    spec_only: bool,
    #[serde(default)]
    version: Option<String>,
}

#[derive(Deserialize)]
struct FixtureRequest {
    name: String,
    #[serde(default)]
    spec_only: bool,
    #[serde(default)]
    version: Option<String>,
}

fn default_network() -> String {
    "testnet".to_string()
}

#[tokio::main]
async fn main() {
    // Set the log filter via env_logger's builder instead of mutating the
    // process environment (std::env::set_var is `unsafe` since Rust 1.80).
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();
    let cli = Cli::parse();

    let compile_env = if cli.no_compile {
        log::info!("Compile endpoint disabled via --no-compile");
        None
    } else {
        let dir = cli
            .compile_dir
            .clone()
            .unwrap_or_else(|| std::env::temp_dir().join("soroban-ret-web-compile"));
        CompileEnv::init(dir, cli.soroban_sdk_version.clone(), cli.stellar_bin.clone()).await
    };

    let registry = Registry::from_env(RET_VERSION);
    log::info!("soroban-ret versions available: {}", registry.available().join(", "));

    let state = Arc::new(AppState {
        mainnet_rpc: cli.mainnet_rpc.clone(),
        testnet_rpc: cli.testnet_rpc.clone(),
        http_client: reqwest::Client::builder()
            .timeout(Duration::from_secs(20))
            .build()
            .expect("Failed to build HTTP client"),
        compile_env,
        registry,
        warm_done: Arc::new(AtomicBool::new(false)),
        warm_ok: Arc::new(AtomicBool::new(false)),
    });

    if state.compile_env.is_some() {
        let warm_state = state.clone();
        tokio::spawn(async move {
            let ok = match warm_state.compile_env.as_ref() {
                Some(env) => env.warm().await,
                None => false,
            };
            warm_state.warm_ok.store(ok, Ordering::SeqCst);
            warm_state.warm_done.store(true, Ordering::SeqCst);
        });
    }

    // CORS: permissive by default (the UI reaches us same-origin via the portal's
    // nginx proxy, and local dev runs the UI on a different port). Set
    // DEVTOOLS_CORS_ALLOW_ORIGINS to a comma-separated allowlist to restrict it
    // when exposing the service cross-origin.
    let cors_origins = std::env::var("DEVTOOLS_CORS_ALLOW_ORIGINS").unwrap_or_default();
    let allow_origin = if cors_origins.trim().is_empty() || cors_origins.trim() == "*" {
        AllowOrigin::any()
    } else {
        let list: Vec<HeaderValue> = cors_origins
            .split(',')
            .filter_map(|o| o.trim().parse::<HeaderValue>().ok())
            .collect();
        log::info!("CORS restricted to: {}", cors_origins.trim());
        AllowOrigin::list(list)
    };
    let cors = CorsLayer::new()
        .allow_origin(allow_origin)
        .allow_methods(Any)
        .allow_headers(Any);

    let api = Router::new()
        .route("/health", get(health))
        .route("/ready", get(ready))
        .route("/versions", get(versions))
        .route("/fixtures", get(list_fixtures))
        .route("/disassemble", post(handle_disassemble))
        .route("/disassemble/upload", post(handle_disassemble_upload))
        .route("/disassemble/fixture", post(handle_disassemble_fixture))
        .route("/address", post(handle_address))
        .route("/compile", post(handle_compile))
        .layer(DefaultBodyLimit::max(cli.max_upload))
        .with_state(state);

    let app = Router::new().nest("/api/dev-tools", api).layer(cors);

    let addr = format!("{}:{}", cli.bind, cli.port);
    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .expect("Failed to bind address");

    log::info!("soroban-ret Dev Tools backend: http://{}", addr);
    eprintln!("soroban-ret Dev Tools backend listening on http://{}", addr);

    axum::serve(listener, app).await.expect("Server error");
}

async fn health() -> &'static str {
    "ok"
}

/// Readiness: only ready once the compile cache is warmed (or compilation is
/// disabled), so orchestrators don't route a `/compile` to us mid-warm.
async fn ready(State(state): State<Arc<AppState>>) -> (StatusCode, &'static str) {
    if state.compile_env.is_none() || state.warm_done.load(Ordering::SeqCst) {
        (StatusCode::OK, "ready")
    } else {
        (StatusCode::SERVICE_UNAVAILABLE, "warming")
    }
}

/// True when compilation is configured and the pre-warm hasn't failed.
/// Optimistic while still warming so the UI doesn't flicker "unavailable".
fn compile_available(state: &AppState) -> bool {
    state.compile_env.is_some()
        && (!state.warm_done.load(Ordering::SeqCst) || state.warm_ok.load(Ordering::SeqCst))
}

async fn versions(State(state): State<Arc<AppState>>) -> Json<VersionsResponse> {
    Json(VersionsResponse {
        current: state.registry.builtin_version.clone(),
        available: state.registry.available(),
        compile_enabled: compile_available(&state),
    })
}

async fn list_fixtures() -> Json<FixtureListResponse> {
    Json(fixtures::list())
}

async fn handle_disassemble(
    State(state): State<Arc<AppState>>,
    Json(req): Json<DisassembleRequest>,
) -> Result<Json<DisassembleResponse>, WebError> {
    let engine = state.registry.resolve(req.version.as_deref())?;
    let wasm = decode_wasm(req.wasm_base64.as_deref(), req.wasm_hex.as_deref())?;
    let resp = disasm::disassemble(wasm, req.spec_only, None, engine, &state.registry.builtin_version).await?;
    Ok(Json(resp))
}

async fn handle_disassemble_upload(
    State(state): State<Arc<AppState>>,
    mut multipart: Multipart,
) -> Result<Json<DisassembleResponse>, WebError> {
    let mut wasm_bytes: Option<Vec<u8>> = None;
    let mut spec_only = false;
    let mut version: Option<String> = None;

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| WebError::InvalidInput(format!("Failed to parse multipart upload: {}", e)))?
    {
        match field.name() {
            Some("wasm") => {
                wasm_bytes = Some(
                    field
                        .bytes()
                        .await
                        .map_err(|e| WebError::InvalidInput(format!("Failed to read upload: {}", e)))?
                        .to_vec(),
                );
            }
            Some("spec_only") => {
                let val = field.text().await.unwrap_or_default();
                spec_only = val == "true" || val == "1";
            }
            Some("version") => {
                let val = field.text().await.unwrap_or_default();
                if !val.is_empty() {
                    version = Some(val);
                }
            }
            _ => {}
        }
    }

    let engine = state.registry.resolve(version.as_deref())?;
    let wasm = wasm_bytes.ok_or_else(|| {
        WebError::InvalidInput("Missing 'wasm' file field in multipart upload".to_string())
    })?;
    if wasm.is_empty() {
        return Err(WebError::InvalidInput("Uploaded file is empty".to_string()));
    }

    let resp = disasm::disassemble(wasm, spec_only, None, engine, &state.registry.builtin_version).await?;
    Ok(Json(resp))
}

async fn handle_disassemble_fixture(
    State(state): State<Arc<AppState>>,
    Json(req): Json<FixtureRequest>,
) -> Result<Json<DisassembleResponse>, WebError> {
    let engine = state.registry.resolve(req.version.as_deref())?;
    let fixture = fixtures::find(&req.name)
        .ok_or_else(|| WebError::InvalidInput(format!("Unknown fixture '{}'", req.name)))?;
    let resp = disasm::disassemble(
        fixture.wasm.to_vec(),
        req.spec_only,
        None,
        engine,
        &state.registry.builtin_version,
    )
    .await?;
    Ok(Json(resp))
}

async fn handle_address(
    State(state): State<Arc<AppState>>,
    Json(req): Json<AddressRequest>,
) -> Result<Json<DisassembleResponse>, WebError> {
    let engine = state.registry.resolve(req.version.as_deref())?;
    let rpc_url = match req.network.as_str() {
        "mainnet" => state.mainnet_rpc.clone(),
        "testnet" => state.testnet_rpc.clone(),
        other => {
            return Err(WebError::InvalidInput(format!(
                "Unknown network '{}'. Use 'mainnet' or 'testnet'",
                other
            )));
        }
    };

    let client = rpc::RpcClient::new(state.http_client.clone(), rpc_url);
    let fetched = client.fetch_contract_wasm(req.address.trim()).await?;
    let resp = disasm::disassemble(
        fetched.wasm,
        req.spec_only,
        Some(fetched.wasm_hash),
        engine,
        &state.registry.builtin_version,
    )
    .await?;
    Ok(Json(resp))
}

async fn handle_compile(
    State(state): State<Arc<AppState>>,
    Json(req): Json<CompileRequest>,
) -> Result<Json<CompileResponse>, WebError> {
    let engine = state.registry.resolve(req.version.as_deref())?;
    if state.warm_done.load(Ordering::SeqCst) && !state.warm_ok.load(Ordering::SeqCst) {
        return Err(WebError::NotConfigured(
            "Compilation is unavailable: the SDK pre-warm build failed on this server".to_string(),
        ));
    }
    let env = state.compile_env.as_ref().ok_or_else(|| {
        WebError::NotConfigured(
            "Compilation is not available on this server (no Rust/wasm32 toolchain)".to_string(),
        )
    })?;
    if req.source.trim().is_empty() {
        return Err(WebError::InvalidInput("Source code is required".to_string()));
    }
    let resp = compile::run_compile(env, req, engine, &state.registry.builtin_version).await?;
    Ok(Json(resp))
}

fn decode_wasm(b64: Option<&str>, hex: Option<&str>) -> Result<Vec<u8>, WebError> {
    if let Some(b64) = b64.filter(|s| !s.is_empty()) {
        return base64::engine::general_purpose::STANDARD
            .decode(b64.trim())
            .map_err(|e| WebError::InvalidInput(format!("Invalid base64 WASM: {}", e)));
    }
    if let Some(hex) = hex.filter(|s| !s.is_empty()) {
        let cleaned: String = hex.chars().filter(|c| !c.is_whitespace()).collect();
        if cleaned.len() % 2 != 0 {
            return Err(WebError::InvalidInput("Hex WASM has odd length".to_string()));
        }
        return (0..cleaned.len())
            .step_by(2)
            .map(|i| {
                u8::from_str_radix(&cleaned[i..i + 2], 16)
                    .map_err(|e| WebError::InvalidInput(format!("Invalid hex WASM: {}", e)))
            })
            .collect();
    }
    Err(WebError::InvalidInput(
        "Provide 'wasm_base64' or 'wasm_hex'".to_string(),
    ))
}

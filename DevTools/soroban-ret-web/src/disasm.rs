//! Disassembly/decompilation wrapper.
//!
//! Produces the serializable [`DisassembleResponse`] the portal UI renders:
//! decompiled Rust, WAT text, a (section-annotated) WASM hex view, and a
//! structured contract summary. The decompiled Rust comes from the selected
//! [`Engine`] (the in-process `soroban-ret` library, or an external CLI binary);
//! WAT / hex / sections are produced locally and are engine-independent.

use crate::engine::Engine;
use crate::error::WebError;
use base64::Engine as _;
use serde::Serialize;
use soroban_ret::DecompileOptions;
use std::sync::OnceLock;
use std::time::{Duration, Instant};
use tokio::sync::Semaphore;

/// Above this size we don't inline a full hex dump in the JSON response (it would
/// balloon the payload ~4x). The base64 is still returned for download.
const HEX_DUMP_LIMIT: usize = 512 * 1024;

/// Max wall-clock for an external CLI engine before we give up on it.
const CLI_TIMEOUT: Duration = Duration::from_secs(60);

/// Bounds how many disassembly jobs run concurrently. Decompilation + WAT +
/// hex are CPU heavy; without a cap a burst of requests could saturate the
/// machine. Sized to the host's parallelism (override with
/// `DEVTOOLS_MAX_CONCURRENCY`).
fn limiter() -> &'static Semaphore {
    static DISASM_LIMITER: OnceLock<Semaphore> = OnceLock::new();
    DISASM_LIMITER.get_or_init(|| {
        let n = std::env::var("DEVTOOLS_MAX_CONCURRENCY")
            .ok()
            .and_then(|v| v.parse::<usize>().ok())
            .filter(|n| *n >= 1)
            .unwrap_or_else(|| {
                std::thread::available_parallelism()
                    .map(|n| n.get())
                    .unwrap_or(4)
                    .max(2)
            });
        log::info!("Disassembly concurrency limit: {}", n);
        Semaphore::new(n)
    })
}

#[derive(Serialize)]
pub struct FunctionInfo {
    pub name: String,
    pub params: Vec<ParamInfo>,
    pub return_type: Option<String>,
    pub takes_env: bool,
    pub is_constructor: bool,
    pub is_check_auth: bool,
    pub body_recovered: bool,
    /// 1-based line of this function in the decompiled `source` (for jump-to).
    pub line_number: Option<usize>,
}

#[derive(Serialize)]
pub struct ParamInfo {
    pub name: String,
    pub type_name: String,
}

#[derive(Serialize)]
pub struct TypeInfo {
    pub name: String,
    pub kind: String,
    pub line_number: Option<usize>,
}

#[derive(Serialize)]
pub struct ContractInfo {
    pub functions: Vec<FunctionInfo>,
    pub types: Vec<TypeInfo>,
    pub has_constructor: bool,
    pub function_count: usize,
    pub type_count: usize,
}

#[derive(Serialize)]
pub struct SectionInfo {
    pub id: u8,
    pub name: String,
    pub size: usize,
    pub offset: usize,
}

#[derive(Serialize)]
pub struct DisassembleResponse {
    pub source: String,
    pub wat: String,
    pub wasm_hex: String,
    /// True when `wasm_hex` was truncated because the module is large.
    pub wasm_hex_truncated: bool,
    pub wasm_base64: String,
    pub wasm_size: usize,
    pub sections: Vec<SectionInfo>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sdk_version: Option<String>,
    pub standard_interfaces: Vec<String>,
    pub warnings: Vec<String>,
    pub is_soroban: bool,
    pub elapsed_ms: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub wasm_hash: Option<String>,
    pub contract_info: ContractInfo,
    /// Which engine produced `source`: "library" (in-process) or "cli".
    pub engine: String,
    /// soroban-ret version that produced `source`.
    pub engine_version: String,
}

/// Decompile `wasm` with the chosen engine and assemble a full response.
pub async fn disassemble(
    wasm: Vec<u8>,
    spec_only: bool,
    wasm_hash: Option<String>,
    engine: Engine,
    builtin_version: &str,
) -> Result<DisassembleResponse, WebError> {
    let start = Instant::now();
    let size = wasm.len();
    let engine_version = engine.version(builtin_version);
    let engine_kind = engine.kind().to_string();

    // Bound concurrent CPU-heavy disassembly jobs.
    let _permit = limiter()
        .acquire()
        .await
        .map_err(|_| WebError::DecompileError("Disassembly limiter closed".to_string()))?;

    let mut response = match engine {
        Engine::Builtin => {
            tokio::task::spawn_blocking(move || builtin_disassemble(wasm, spec_only))
                .await
                .map_err(|e| WebError::DecompileError(format!("Decompile task panicked: {}", e)))??
        }
        Engine::Cli { path, version } => cli_disassemble(wasm, &path, &version).await?,
    };

    response.wasm_size = size;
    response.wasm_hash = wasm_hash;
    response.engine = engine_kind;
    response.engine_version = engine_version;
    response.elapsed_ms = start.elapsed().as_millis() as u64;
    Ok(response)
}

/// Parts of the response that don't depend on the decompiler engine.
struct CommonParts {
    wat: String,
    wasm_hex: String,
    wasm_hex_truncated: bool,
    wasm_base64: String,
    sections: Vec<SectionInfo>,
}

fn common_parts(wasm: &[u8]) -> CommonParts {
    let wat = soroban_ret::wasm_to_wat(wasm)
        .unwrap_or_else(|e| format!("// WAT generation failed: {}", e));
    let sections = parse_sections(wasm);
    let (wasm_hex, wasm_hex_truncated) = if wasm.len() > HEX_DUMP_LIMIT {
        (
            format!(
                "// Module is {} bytes; hex view truncated to the first {} bytes.\n// Use the .wasm download for the full binary.\n\n{}",
                wasm.len(),
                HEX_DUMP_LIMIT,
                hex_dump(&wasm[..HEX_DUMP_LIMIT])
            ),
            true,
        )
    } else {
        (hex_dump(wasm), false)
    };
    CommonParts {
        wat,
        wasm_hex,
        wasm_hex_truncated,
        wasm_base64: base64::engine::general_purpose::STANDARD.encode(wasm),
        sections,
    }
}

fn builtin_disassemble(wasm: Vec<u8>, spec_only: bool) -> Result<DisassembleResponse, WebError> {
    let mut options = DecompileOptions::default();
    options.spec_only = spec_only;
    let ir = soroban_ret::decompile_to_ir_with_options(&wasm, &options)?;

    let warnings: Vec<String> = ir
        .validation
        .diagnostics
        .iter()
        .map(|d| d.to_string())
        .collect();

    let source = ir.source.clone();
    let contract_info = build_contract_info(&ir, &source);
    let common = common_parts(&wasm);

    Ok(DisassembleResponse {
        source,
        wat: common.wat,
        wasm_hex: common.wasm_hex,
        wasm_hex_truncated: common.wasm_hex_truncated,
        wasm_base64: common.wasm_base64,
        wasm_size: wasm.len(),
        sections: common.sections,
        sdk_version: ir.sdk_version,
        standard_interfaces: ir.standard_interfaces,
        warnings,
        is_soroban: ir.contract_module.is_soroban,
        elapsed_ms: 0,
        wasm_hash: None,
        contract_info,
        engine: String::new(),
        engine_version: String::new(),
    })
}

/// Decompile by shelling out to an external `soroban-ret` CLI binary. The CLI
/// emits decompiled Rust on stdout; everything else is derived locally. We pass
/// only the positional input path — older CLI releases don't accept flags like
/// `--spec-only`, so `spec_only` is honored by the builtin engine only.
async fn cli_disassemble(
    wasm: Vec<u8>,
    bin: &std::path::Path,
    version: &str,
) -> Result<DisassembleResponse, WebError> {
    // Unique per call (the disassembly semaphore allows concurrent jobs, so a
    // content-derived name could collide and let one request clobber another's
    // file between write and the CLI's open).
    use std::sync::atomic::{AtomicU64, Ordering};
    static TMP_SEQ: AtomicU64 = AtomicU64::new(0);
    let seq = TMP_SEQ.fetch_add(1, Ordering::Relaxed);
    let tmp = std::env::temp_dir().join(format!(
        "devtools-disasm-{}-{:016x}.wasm",
        std::process::id(),
        seq
    ));
    tokio::fs::write(&tmp, &wasm)
        .await
        .map_err(|e| WebError::DecompileError(format!("Failed to stage WASM: {}", e)))?;

    let run = tokio::time::timeout(
        CLI_TIMEOUT,
        // kill_on_drop so a timed-out (dropped) child is reaped instead of being
        // orphaned and holding the temp file open.
        tokio::process::Command::new(bin)
            .arg(&tmp)
            .kill_on_drop(true)
            .output(),
    )
    .await;
    let _ = tokio::fs::remove_file(&tmp).await;
    let output = match run {
        Err(_) => {
            return Err(WebError::DecompileError(format!(
                "soroban-ret CLI {} timed out after {}s",
                version,
                CLI_TIMEOUT.as_secs()
            )));
        }
        Ok(Err(e)) => {
            return Err(WebError::DecompileError(format!(
                "Failed to run soroban-ret CLI: {}",
                e
            )));
        }
        Ok(Ok(output)) => output,
    };

    let stdout = String::from_utf8_lossy(&output.stdout).into_owned();
    let stderr = String::from_utf8_lossy(&output.stderr).into_owned();

    if !output.status.success() {
        return Err(WebError::DecompileError(format!(
            "soroban-ret CLI {} failed: {}",
            version,
            stderr.trim()
        )));
    }

    // Some early CLI releases print only a summary to stderr and emit no Rust on
    // stdout. Surface that truthfully instead of a blank panel.
    let (source, warnings) = if stdout.trim().is_empty() {
        let body = stderr
            .lines()
            .filter(|l| !l.trim().is_empty())
            .map(|l| format!("// {}", l.trim()))
            .collect::<Vec<_>>()
            .join("\n");
        (
            format!(
                "// soroban-ret {version} (external CLI) emitted no Rust source for this module.\n// Tool output:\n{body}",
            ),
            vec![format!(
                "soroban-ret CLI {version} produced no source; showing tool output"
            )],
        )
    } else {
        (stdout, Vec::new())
    };

    let common = common_parts(&wasm);

    Ok(DisassembleResponse {
        source,
        wat: common.wat,
        wasm_hex: common.wasm_hex,
        wasm_hex_truncated: common.wasm_hex_truncated,
        wasm_base64: common.wasm_base64,
        wasm_size: wasm.len(),
        sections: common.sections,
        sdk_version: None,
        standard_interfaces: Vec::new(),
        warnings,
        // Engine-independent detection: Soroban contracts carry a contractspecv0
        // custom section.
        is_soroban: contains_subslice(&wasm, b"contractspecv0"),
        elapsed_ms: 0,
        wasm_hash: None,
        contract_info: ContractInfo {
            functions: Vec::new(),
            types: Vec::new(),
            has_constructor: false,
            function_count: 0,
            type_count: 0,
        },
        engine: String::new(),
        engine_version: String::new(),
    })
}

fn type_def_to_string(spec: &stellar_xdr::curr::ScSpecTypeDef) -> String {
    let tokens = soroban_ret::codegen::types::generate_type_ident(spec);
    tokens.to_string().replace(' ', "")
}

fn find_line_number(source: &str, pattern: &str) -> Option<usize> {
    source
        .lines()
        .enumerate()
        .find(|(_, line)| line.contains(pattern))
        .map(|(i, _)| i + 1)
}

fn build_contract_info(ir: &soroban_ret::DecompileIR, source: &str) -> ContractInfo {
    use soroban_ret::ir::high_level_ir::TypeDefKind;

    let functions: Vec<FunctionInfo> = ir
        .contract_module
        .functions
        .iter()
        .map(|f| {
            let params: Vec<ParamInfo> = f
                .params
                .iter()
                .map(|p| ParamInfo {
                    name: p.name.clone(),
                    type_name: type_def_to_string(&p.type_def),
                })
                .collect();
            let return_type = f.return_type.as_ref().map(type_def_to_string);
            let body_recovered = !f.body.is_empty()
                && !matches!(
                    f.body.as_slice(),
                    [soroban_ret::ir::SorobanStmt::Expr(
                        soroban_ret::ir::SorobanExpr::Panic
                    )]
                );
            FunctionInfo {
                line_number: find_line_number(source, &format!("fn {}(", f.name)),
                name: f.name.clone(),
                params,
                return_type,
                takes_env: f.takes_env,
                is_constructor: f.is_constructor,
                is_check_auth: f.is_check_auth,
                body_recovered,
            }
        })
        .collect();

    let map_type_defs = |defs: &[soroban_ret::ir::high_level_ir::TypeDef]| -> Vec<TypeInfo> {
        defs.iter()
            .map(|t| {
                let (kind, pattern) = match t.kind {
                    TypeDefKind::Struct => ("struct", format!("struct {}", t.name)),
                    TypeDefKind::TupleStruct => ("tuple_struct", format!("struct {}", t.name)),
                    TypeDefKind::Union => ("union", format!("enum {}", t.name)),
                    TypeDefKind::Enum => ("enum", format!("enum {}", t.name)),
                    TypeDefKind::ErrorEnum => ("error_enum", format!("enum {}", t.name)),
                    TypeDefKind::Event => ("event", format!("struct {}", t.name)),
                };
                TypeInfo {
                    name: t.name.clone(),
                    kind: kind.to_string(),
                    line_number: find_line_number(source, &pattern),
                }
            })
            .collect()
    };

    let mut types = map_type_defs(&ir.contract_module.types);
    types.extend(map_type_defs(&ir.contract_module.error_enums));
    types.extend(map_type_defs(&ir.contract_module.events));

    let function_count = functions.len();
    let type_count = types.len();

    ContractInfo {
        functions,
        types,
        has_constructor: ir.contract_module.has_constructor,
        function_count,
        type_count,
    }
}

/// Parse the top-level WASM section table for the annotated view.
fn parse_sections(wasm: &[u8]) -> Vec<SectionInfo> {
    let mut out = Vec::new();
    if wasm.len() < 8 || &wasm[0..4] != b"\0asm" {
        return out;
    }
    let mut pos = 8usize; // skip magic + version
    while pos < wasm.len() {
        let id = wasm[pos];
        pos += 1;
        let Some((size, consumed)) = read_leb_u32(&wasm[pos..]) else {
            break;
        };
        pos += consumed;
        let offset = pos;
        let size = size as usize;
        if offset + size > wasm.len() {
            break;
        }
        let name = if id == 0 {
            // Custom section: payload starts with a name (leb len + utf8 bytes).
            read_custom_name(&wasm[offset..offset + size])
                .map(|n| format!("custom:{}", n))
                .unwrap_or_else(|| "custom".to_string())
        } else {
            section_name(id).to_string()
        };
        out.push(SectionInfo {
            id,
            name,
            size,
            offset,
        });
        pos = offset + size;
    }
    out
}

fn section_name(id: u8) -> &'static str {
    match id {
        1 => "type",
        2 => "import",
        3 => "function",
        4 => "table",
        5 => "memory",
        6 => "global",
        7 => "export",
        8 => "start",
        9 => "element",
        10 => "code",
        11 => "data",
        12 => "data_count",
        _ => "unknown",
    }
}

fn read_custom_name(payload: &[u8]) -> Option<String> {
    let (len, consumed) = read_leb_u32(payload)?;
    let start = consumed;
    let end = start + len as usize;
    if end > payload.len() {
        return None;
    }
    String::from_utf8(payload[start..end].to_vec()).ok()
}

fn read_leb_u32(bytes: &[u8]) -> Option<(u32, usize)> {
    let mut result: u32 = 0;
    let mut shift = 0;
    for (i, &b) in bytes.iter().enumerate().take(5) {
        result |= ((b & 0x7f) as u32) << shift;
        if b & 0x80 == 0 {
            return Some((result, i + 1));
        }
        shift += 7;
    }
    None
}

fn contains_subslice(haystack: &[u8], needle: &[u8]) -> bool {
    if needle.is_empty() || haystack.len() < needle.len() {
        return false;
    }
    haystack
        .windows(needle.len())
        .any(|window| window == needle)
}

/// Classic `xxd`-style hex dump: offset, 16 hex bytes, ASCII gutter.
fn hex_dump(bytes: &[u8]) -> String {
    let mut out = String::with_capacity(bytes.len() * 4);
    for (i, chunk) in bytes.chunks(16).enumerate() {
        out.push_str(&format!("{:08x}  ", i * 16));
        for (j, b) in chunk.iter().enumerate() {
            out.push_str(&format!("{:02x} ", b));
            if j == 7 {
                out.push(' ');
            }
        }
        for j in chunk.len()..16 {
            out.push_str("   ");
            if j == 7 {
                out.push(' ');
            }
        }
        out.push_str(" |");
        for b in chunk {
            let c = *b;
            out.push(if (0x20..0x7f).contains(&c) {
                c as char
            } else {
                '.'
            });
        }
        out.push_str("|\n");
    }
    out
}

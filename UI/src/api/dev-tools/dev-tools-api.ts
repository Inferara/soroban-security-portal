import { environment } from '../../environments/environment';

// Client for the Dev Tools backend (soroban-ret-web). This service is separate
// from the main portal API: it compiles Rust -> WASM, disassembles WASM with
// soroban-ret, and fetches on-chain contracts by address. It needs no auth.

const baseUrl = environment.devToolsApiUrl;

export interface ParamInfo {
  name: string;
  type_name: string;
}

export interface FunctionInfo {
  name: string;
  params: ParamInfo[];
  return_type?: string | null;
  takes_env: boolean;
  is_constructor: boolean;
  is_check_auth: boolean;
  body_recovered: boolean;
  line_number?: number | null;
}

export interface TypeInfo {
  name: string;
  kind: string;
  line_number?: number | null;
}

export interface ContractInfo {
  functions: FunctionInfo[];
  types: TypeInfo[];
  has_constructor: boolean;
  function_count: number;
  type_count: number;
}

export interface SectionInfo {
  id: number;
  name: string;
  size: number;
  offset: number;
}

export interface DisassembleResponse {
  source: string;
  wat: string;
  wasm_hex: string;
  wasm_hex_truncated: boolean;
  wasm_base64: string;
  wasm_size: number;
  sections: SectionInfo[];
  sdk_version?: string | null;
  standard_interfaces: string[];
  warnings: string[];
  is_soroban: boolean;
  elapsed_ms: number;
  wasm_hash?: string | null;
  contract_info: ContractInfo;
  engine: string;
  engine_version: string;
}

export interface CompileDiagnostic {
  level: string;
  message: string;
  code?: string | null;
  line?: number | null;
  column?: number | null;
  end_line?: number | null;
  end_column?: number | null;
  children: CompileDiagnostic[];
}

export interface CompileResponse {
  success: boolean;
  diagnostics: CompileDiagnostic[];
  error_count: number;
  warning_count: number;
  elapsed_ms: number;
  builder: string;
  result?: DisassembleResponse | null;
}

export interface VersionsResponse {
  current: string;
  available: string[];
  compile_enabled: boolean;
}

export interface FixtureInfo {
  name: string;
  description: string;
  size: number;
}

export interface FixtureListResponse {
  fixtures: FixtureInfo[];
}

export type Network = 'testnet' | 'mainnet';

/**
 * Read the JSON body of a Dev Tools API response, raising a descriptive error
 * for non-2xx responses (the backend returns `{ error, kind }`).
 */
async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  let parsed: unknown = undefined;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      // non-JSON body; fall through to raw text on error
    }
  }
  if (!res.ok) {
    const err = parsed as { error?: string; kind?: string } | undefined;
    const message = err?.error ?? text ?? `Request failed (${res.status})`;
    throw new Error(message);
  }
  return parsed as T;
}

export async function getVersions(signal?: AbortSignal): Promise<VersionsResponse> {
  return readJson<VersionsResponse>(await fetch(`${baseUrl}/versions`, { method: 'GET', signal }));
}

export async function getFixtures(signal?: AbortSignal): Promise<FixtureListResponse> {
  return readJson<FixtureListResponse>(await fetch(`${baseUrl}/fixtures`, { method: 'GET', signal }));
}

export async function disassembleBase64(
  wasmBase64: string,
  version: string,
  specOnly = false,
  signal?: AbortSignal,
): Promise<DisassembleResponse> {
  const res = await fetch(`${baseUrl}/disassemble`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wasm_base64: wasmBase64, spec_only: specOnly, version }),
    signal,
  });
  return readJson<DisassembleResponse>(res);
}

export async function disassembleUpload(
  file: File,
  version: string,
  specOnly = false,
  signal?: AbortSignal,
): Promise<DisassembleResponse> {
  const form = new FormData();
  form.append('wasm', file);
  form.append('spec_only', specOnly ? 'true' : 'false');
  form.append('version', version);
  const res = await fetch(`${baseUrl}/disassemble/upload`, { method: 'POST', body: form, signal });
  return readJson<DisassembleResponse>(res);
}

export async function disassembleFixture(
  name: string,
  version: string,
  specOnly = false,
  signal?: AbortSignal,
): Promise<DisassembleResponse> {
  const res = await fetch(`${baseUrl}/disassemble/fixture`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, spec_only: specOnly, version }),
    signal,
  });
  return readJson<DisassembleResponse>(res);
}

export async function disassembleAddress(
  address: string,
  network: Network,
  version: string,
  specOnly = false,
  signal?: AbortSignal,
): Promise<DisassembleResponse> {
  const res = await fetch(`${baseUrl}/address`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, network, spec_only: specOnly, version }),
    signal,
  });
  return readJson<DisassembleResponse>(res);
}

export async function compileRust(
  source: string,
  version: string,
  specOnly = false,
  signal?: AbortSignal,
): Promise<CompileResponse> {
  const res = await fetch(`${baseUrl}/compile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source, spec_only: specOnly, version }),
    signal,
  });
  return readJson<CompileResponse>(res);
}

/** Client-side sanity check for a Stellar contract address (C... strkey). */
export function isLikelyContractAddress(addr: string): boolean {
  return /^C[A-Z2-7]{55}$/.test(addr.trim());
}

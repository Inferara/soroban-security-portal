import { FC, useCallback, useEffect, useRef, useState } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { useSearchParams } from 'react-router-dom';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  Alert,
  Checkbox,
  Paper,
  Link as MuiLink,
} from '@mui/material';
import BuildIcon from '@mui/icons-material/Build';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import TravelExploreIcon from '@mui/icons-material/TravelExplore';
import ScienceIcon from '@mui/icons-material/Science';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopCircleIcon from '@mui/icons-material/StopCircle';
import ShareIcon from '@mui/icons-material/Share';
import { useTheme } from '../../../../contexts/ThemeContext';
import { OutputPanel } from './OutputPanel';
import { SplitPane } from './SplitPane';
import { SamplesGrid } from './SamplesGrid';
import {
  CompileResponse,
  DisassembleResponse,
  FixtureInfo,
  Network,
  compileRust,
  disassembleAddress,
  disassembleFixture,
  disassembleUpload,
  getFixtures,
  getVersions,
  isLikelyContractAddress,
} from '../../../../api/dev-tools/dev-tools-api';
import { DiagnosticsList } from './DiagnosticsList';

const DEFAULT_RUST = `#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Env};

#[contracttype]
pub enum DataKey {
    Counter,
}

#[contract]
pub struct Contract;

#[contractimpl]
impl Contract {
    /// Increment a persistent counter and return the new value.
    pub fn increment(env: Env) -> u32 {
        let count: u32 = env.storage().instance().get(&DataKey::Counter).unwrap_or(0);
        let next = count + 1;
        env.storage().instance().set(&DataKey::Counter, &next);
        next
    }
}
`;

const EXAMPLE_ADDRESSES: { label: string; address: string; network: Network }[] = [
  { label: 'Blend backstop (mainnet)', address: 'CAQQR5SWBXKIGZKPBZDH3KM5GQ5GUTPKB7JAFCINLZBC5WXPJKRG3IM7', network: 'mainnet' },
];

type Mode = 0 | 1 | 2 | 3;
const MODES = ['compile', 'upload', 'address', 'samples'] as const;
const LS = {
  source: 'devtools.source',
  version: 'devtools.version',
  mode: 'devtools.mode',
  address: 'devtools.address',
  network: 'devtools.network',
  fixture: 'devtools.fixture',
};

/* eslint-disable @typescript-eslint/no-explicit-any */
export const DevTools: FC = () => {
  const { themeMode } = useTheme();
  const monacoTheme = themeMode === 'dark' ? 'vs-dark' : 'light';
  const [, setSearchParams] = useSearchParams();

  // version metadata
  const [versions, setVersions] = useState<string[]>([]);
  const [currentVersion, setCurrentVersion] = useState('');
  const [selectedVersion, setSelectedVersion] = useState('');
  const [compileEnabled, setCompileEnabled] = useState(true);
  const [versionsError, setVersionsError] = useState<string | null>(null);

  // shared
  const [mode, setMode] = useState<Mode>(0);
  const [specOnly, setSpecOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DisassembleResponse | null>(null);
  const [compileResult, setCompileResult] = useState<CompileResponse | null>(null);
  const [diffSource, setDiffSource] = useState<string | undefined>(undefined);
  const [provNetwork, setProvNetwork] = useState<Network | undefined>(undefined);

  // inputs
  const [rust, setRust] = useState(DEFAULT_RUST);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [address, setAddress] = useState('');
  const [network, setNetwork] = useState<Network>('testnet');
  const [fixtures, setFixtures] = useState<FixtureInfo[]>([]);
  const [selectedFixture, setSelectedFixture] = useState('');

  const abortRef = useRef<AbortController | null>(null);
  const inputEditorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);

  const addressValid = isLikelyContractAddress(address);

  // ---- mount: load metadata, apply deep-link or restore persisted state ----
  useEffect(() => {
    let mounted = true;
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const [v, f] = await Promise.allSettled([getVersions(), getFixtures()]);
      if (!mounted) return;
      let avail: string[] = [];
      let current = '';
      if (v.status === 'fulfilled') {
        avail = v.value.available;
        current = v.value.current;
        setVersions(avail);
        setCurrentVersion(current);
        setCompileEnabled(v.value.compile_enabled);
      } else {
        setVersionsError((v.reason as Error).message);
      }
      if (f.status === 'fulfilled') setFixtures(f.value.fixtures);

      const urlVersion = params.get('version');
      const lsVersion = localStorage.getItem(LS.version);
      const ver =
        urlVersion && avail.includes(urlVersion)
          ? urlVersion
          : lsVersion && avail.includes(lsVersion)
            ? lsVersion
            : current;
      setSelectedVersion(ver);

      const lsSource = localStorage.getItem(LS.source);
      if (lsSource) setRust(lsSource);
      const lsAddr = localStorage.getItem(LS.address);
      if (lsAddr) setAddress(lsAddr);
      const lsNet = localStorage.getItem(LS.network);
      if (lsNet === 'mainnet' || lsNet === 'testnet') setNetwork(lsNet);
      const lsFix = localStorage.getItem(LS.fixture);
      if (lsFix) setSelectedFixture(lsFix);
      else if (f.status === 'fulfilled' && f.value.fixtures.length) setSelectedFixture(f.value.fixtures[0].name);

      // Deep-link: auto-run address / fixture; otherwise just set the mode.
      const urlAddress = params.get('address');
      const urlNetwork = (params.get('network') as Network) || 'testnet';
      const urlFixture = params.get('fixture');
      const urlMode = params.get('mode');
      if (urlAddress) {
        setMode(2);
        setAddress(urlAddress);
        setNetwork(urlNetwork === 'mainnet' ? 'mainnet' : 'testnet');
        void doAddress(urlAddress, urlNetwork === 'mainnet' ? 'mainnet' : 'testnet', ver);
      } else if (urlFixture) {
        setMode(3);
        setSelectedFixture(urlFixture);
        void doFixture(urlFixture, ver);
      } else if (urlMode) {
        const idx = MODES.indexOf(urlMode as (typeof MODES)[number]);
        if (idx >= 0) setMode(idx as Mode);
      } else {
        const lsMode = Number(localStorage.getItem(LS.mode));
        if (lsMode >= 0 && lsMode <= 3) setMode(lsMode as Mode);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // ---- persistence ----
  useEffect(() => {
    localStorage.setItem(LS.source, rust);
  }, [rust]);
  useEffect(() => {
    if (selectedVersion) localStorage.setItem(LS.version, selectedVersion);
  }, [selectedVersion]);
  useEffect(() => {
    localStorage.setItem(LS.mode, String(mode));
  }, [mode]);
  useEffect(() => {
    localStorage.setItem(LS.address, address);
  }, [address]);
  useEffect(() => {
    localStorage.setItem(LS.network, network);
  }, [network]);
  useEffect(() => {
    if (selectedFixture) localStorage.setItem(LS.fixture, selectedFixture);
  }, [selectedFixture]);

  // ---- elapsed timer while loading ----
  useEffect(() => {
    if (!loading) {
      setElapsed(0);
      return;
    }
    const started = Date.now();
    const id = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 500);
    return () => window.clearInterval(id);
  }, [loading]);

  const setMarkers = useCallback((diags: CompileResponse['diagnostics']) => {
    const ed = inputEditorRef.current;
    const monaco = monacoRef.current;
    if (!ed || !monaco) return;
    const model = ed.getModel();
    if (!model) return;
    const markers = diags
      .filter((d) => d.line)
      .map((d) => ({
        startLineNumber: d.line as number,
        startColumn: d.column ?? 1,
        endLineNumber: d.end_line ?? (d.line as number),
        endColumn: d.end_column ?? (d.column ? d.column + 1 : 200),
        message: `${d.code ? `[${d.code}] ` : ''}${d.message}`,
        severity: d.level === 'error' ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning,
      }));
    monaco.editor.setModelMarkers(model, 'devtools', markers);
  }, []);

  const clearMarkers = useCallback(() => {
    const ed = inputEditorRef.current;
    const monaco = monacoRef.current;
    if (ed && monaco) monaco.editor.setModelMarkers(ed.getModel(), 'devtools', []);
  }, []);

  const resetOutputs = () => {
    setError(null);
    setResult(null);
    setCompileResult(null);
    setDiffSource(undefined);
    setProvNetwork(undefined);
    clearMarkers();
  };

  const startRun = () => {
    resetOutputs();
    setLoading(true);
    abortRef.current = new AbortController();
    return abortRef.current.signal;
  };
  const isAbort = (e: unknown) => e instanceof Error && e.name === 'AbortError';

  const cancel = () => abortRef.current?.abort();

  // ---- run actions (explicit args so deep-link can call before state settles) ----
  const doCompile = async (source: string, version: string) => {
    const signal = startRun();
    updateUrl({ mode: 'compile', version });
    try {
      const resp = await compileRust(source, version, specOnly, signal);
      setCompileResult(resp);
      setMarkers(resp.diagnostics);
      if (resp.success && resp.result) {
        setResult(resp.result);
        setDiffSource(source);
      }
    } catch (e) {
      if (!isAbort(e)) setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const doUpload = async (f: File, version: string) => {
    const signal = startRun();
    updateUrl({ mode: 'upload', version });
    try {
      setResult(await disassembleUpload(f, version, specOnly, signal));
    } catch (e) {
      if (!isAbort(e)) setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const doAddress = async (addr: string, net: Network, version: string) => {
    const signal = startRun();
    updateUrl({ mode: 'address', version, address: addr, network: net });
    try {
      setResult(await disassembleAddress(addr.trim(), net, version, specOnly, signal));
      setProvNetwork(net);
    } catch (e) {
      if (!isAbort(e)) setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const doFixture = async (name: string, version: string) => {
    const signal = startRun();
    updateUrl({ mode: 'samples', version, fixture: name });
    try {
      setResult(await disassembleFixture(name, version, specOnly, signal));
    } catch (e) {
      if (!isAbort(e)) setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const updateUrl = (params: Record<string, string>) => {
    setSearchParams(params, { replace: true });
  };

  const shareUrl = () => {
    const p = new URLSearchParams({ mode: MODES[mode], version: selectedVersion });
    if (mode === 2 && address) {
      p.set('address', address.trim());
      p.set('network', network);
    }
    if (mode === 3 && selectedFixture) p.set('fixture', selectedFixture);
    const url = `${window.location.origin}${window.location.pathname}?${p.toString()}`;
    void navigator.clipboard.writeText(url);
  };

  const handleModeChange = (next: Mode) => {
    setMode(next);
    resetOutputs();
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) {
      setFile(f);
      void doUpload(f, selectedVersion);
    }
  };

  // ---- result / status area (shared; placed in the right pane for compile) ----
  const statusBlock = (
    <>
      {loading && (
        <Paper variant="outlined" sx={{ p: 3, textAlign: 'center', mt: mode === 0 ? 0 : 2 }}>
          <CircularProgress size={28} sx={{ mb: 1 }} />
          <Typography variant="body2">Working… {elapsed}s</Typography>
          {mode === 0 && elapsed > 5 && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              First compile builds the soroban-sdk — this can take a few minutes.
            </Typography>
          )}
          <Button size="small" color="inherit" startIcon={<StopCircleIcon />} onClick={cancel} sx={{ mt: 1 }}>
            Cancel
          </Button>
        </Paper>
      )}

      {error && (
        <Alert severity="error" sx={{ mt: mode === 0 ? 0 : 2 }}>
          {error}
        </Alert>
      )}

      {compileResult && (
        <Box sx={{ mt: mode === 0 ? 0 : 2 }}>
          {compileResult.success ? (
            <Alert severity="success">
              Compiled successfully via {compileResult.builder} in {compileResult.elapsed_ms} ms
              {compileResult.warning_count > 0 ? ` (${compileResult.warning_count} warnings)` : ''}.
            </Alert>
          ) : (
            <Alert severity="error">
              Compilation failed with {compileResult.error_count} error
              {compileResult.error_count === 1 ? '' : 's'} ({compileResult.builder}, {compileResult.elapsed_ms} ms).
            </Alert>
          )}
          {compileResult.diagnostics.length > 0 && <DiagnosticsList diagnostics={compileResult.diagnostics} />}
        </Box>
      )}

      {result && <OutputPanel data={result} originalSource={diffSource} provenance={provNetwork ? { network: provNetwork } : undefined} />}

      {mode === 0 && !loading && !result && !compileResult && !error && (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
          <BuildIcon sx={{ fontSize: 40, opacity: 0.5 }} />
          <Typography variant="body2" sx={{ mt: 1 }}>
            Write a contract and press <b>Compile &amp; Disassemble</b> (⌘/Ctrl+Enter).
          </Typography>
        </Paper>
      )}
    </>
  );

  const compileControls = (
    <Box>
      <Box sx={{ height: 380, border: 1, borderColor: 'divider', borderRadius: 1.5, overflow: 'hidden' }}>
        <Editor
          height="100%"
          theme={monacoTheme}
          language="rust"
          value={rust}
          onChange={(v) => {
            setRust(v ?? '');
            clearMarkers();
          }}
          onMount={
            ((ed: any, monaco: any) => {
              inputEditorRef.current = ed;
              monacoRef.current = monaco;
            }) as OnMount
          }
          options={{ minimap: { enabled: false }, fontSize: 14, scrollBeyondLastLine: false, automaticLayout: true }}
        />
      </Box>
      <Stack direction="row" spacing={2} sx={{ mt: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
        <Button
          variant="contained"
          startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <PlayArrowIcon />}
          onClick={() => doCompile(rust, selectedVersion)}
          disabled={loading || !compileEnabled}
        >
          Compile &amp; Disassemble
        </Button>
        <FormControlLabel control={<Checkbox checked={specOnly} onChange={(e) => setSpecOnly(e.target.checked)} />} label="Spec only" />
        <Typography variant="caption" color="text.secondary">
          ⌘/Ctrl+Enter to run.
        </Typography>
      </Stack>
      <Alert severity="info" sx={{ mt: 1.5 }} variant="outlined">
        Decompilation fidelity depends on the soroban-ret version. Freshly compiled snippets may not round-trip exactly;
        real and optimized contracts (and the <b>Samples</b> tab) recover best.
      </Alert>
    </Box>
  );

  // ---- Ctrl/Cmd+Enter ----
  // Keep a ref to the current "run" action so the keydown listener (registered
  // once) always calls the latest closure. Updated in an effect, not during
  // render, to avoid mutating a ref while rendering.
  const runnerRef = useRef<() => void>(() => {});
  useEffect(() => {
    runnerRef.current = () => {
      if (loading) return;
      if (mode === 0) void doCompile(rust, selectedVersion);
      else if (mode === 1 && file) void doUpload(file, selectedVersion);
      else if (mode === 2 && addressValid) void doAddress(address, network, selectedVersion);
      else if (mode === 3 && selectedFixture) void doFixture(selectedFixture, selectedVersion);
    };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        runnerRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <Box sx={{ maxWidth: 1280, mx: 'auto' }}>
      {/* Header */}
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: { md: 'flex-end' }, justifyContent: 'space-between', mb: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            Dev Tools
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
            Compile Rust to WebAssembly, disassemble Soroban contracts, and inspect on-chain bytecode with{' '}
            <MuiLink href="https://github.com/Inferara/soroban-ret" target="_blank" rel="noopener noreferrer">
              soroban-ret
            </MuiLink>
            .
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <Button size="small" variant="outlined" startIcon={<ShareIcon />} onClick={shareUrl}>
            Copy link
          </Button>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel id="ret-version-label">soroban-ret version</InputLabel>
            <Select labelId="ret-version-label" label="soroban-ret version" value={selectedVersion} onChange={(e) => setSelectedVersion(e.target.value)} disabled={versions.length === 0}>
              {versions.map((v) => (
                <MenuItem key={v} value={v}>
                  v{v}
                  {v === currentVersion ? ' (current)' : ''}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </Stack>

      {versionsError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Could not reach the Dev Tools backend: {versionsError}
        </Alert>
      )}

      {/* Mode selector */}
      <Paper variant="outlined" sx={{ mb: 2 }}>
        <Tabs value={mode} onChange={(_, v) => handleModeChange(v as Mode)} variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile>
          <Tab icon={<BuildIcon />} iconPosition="start" label="Compile Rust" sx={{ textTransform: 'none' }} />
          <Tab icon={<UploadFileIcon />} iconPosition="start" label="Upload WASM" sx={{ textTransform: 'none' }} />
          <Tab icon={<TravelExploreIcon />} iconPosition="start" label="By Address" sx={{ textTransform: 'none' }} />
          <Tab icon={<ScienceIcon />} iconPosition="start" label="Samples" sx={{ textTransform: 'none' }} />
        </Tabs>
      </Paper>

      {mode === 0 && !compileEnabled && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Compilation is not available on this server (no Rust/wasm32 toolchain). You can still disassemble samples,
          uploaded WASM, or fetch contracts by address.
        </Alert>
      )}

      {/* Mode: Compile — side-by-side editor / result */}
      {mode === 0 && <SplitPane storageKey="devtools.split" left={compileControls} right={statusBlock} />}

      {/* Mode: Upload */}
      {mode === 1 && (
        <Box>
          <Paper
            variant="outlined"
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            sx={{
              p: 4,
              textAlign: 'center',
              borderStyle: 'dashed',
              borderColor: dragOver ? 'primary.main' : 'divider',
              bgcolor: dragOver ? 'action.hover' : 'transparent',
            }}
          >
            <UploadFileIcon sx={{ fontSize: 36, opacity: 0.6 }} />
            <Typography sx={{ mt: 1 }}>Drag &amp; drop a .wasm file here, or</Typography>
            <Button variant="outlined" component="label" sx={{ mt: 1 }} startIcon={<UploadFileIcon />}>
              Choose .wasm file
              <input hidden type="file" accept=".wasm,application/wasm" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </Button>
            {file && (
              <Box sx={{ mt: 2 }}>
                <Chip label={`${file.name} (${file.size.toLocaleString()} bytes)`} onDelete={() => setFile(null)} />
              </Box>
            )}
          </Paper>
          <Stack direction="row" spacing={2} sx={{ mt: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
            <FormControlLabel control={<Checkbox checked={specOnly} onChange={(e) => setSpecOnly(e.target.checked)} />} label="Spec only" />
            <Button variant="contained" startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <PlayArrowIcon />} onClick={() => file && doUpload(file, selectedVersion)} disabled={loading || !file}>
              Disassemble
            </Button>
          </Stack>
          {statusBlock}
        </Box>
      )}

      {/* Mode: By Address */}
      {mode === 2 && (
        <Box>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: { md: 'flex-start' } }}>
            <TextField
              label="Contract address (C…)"
              placeholder="CABC…"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              fullWidth
              size="small"
              error={address.length > 0 && !addressValid}
              helperText={address.length > 0 && !addressValid ? 'Must be 56 chars starting with C (base32).' : ' '}
            />
            <ToggleButtonGroup exclusive size="small" color="primary" value={network} onChange={(_, v) => v && setNetwork(v as Network)}>
              <ToggleButton value="testnet">Testnet</ToggleButton>
              <ToggleButton value="mainnet">Mainnet</ToggleButton>
            </ToggleButtonGroup>
            <Button variant="contained" startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <PlayArrowIcon />} onClick={() => doAddress(address, network, selectedVersion)} disabled={loading || !addressValid} sx={{ whiteSpace: 'nowrap' }}>
              Fetch &amp; Disassemble
            </Button>
          </Stack>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography variant="caption" color="text.secondary">
              Examples:
            </Typography>
            {EXAMPLE_ADDRESSES.map((ex) => (
              <Chip key={ex.address} size="small" variant="outlined" clickable label={ex.label} onClick={() => { setAddress(ex.address); setNetwork(ex.network); }} />
            ))}
            <Box sx={{ flexGrow: 1 }} />
            <FormControlLabel control={<Checkbox checked={specOnly} onChange={(e) => setSpecOnly(e.target.checked)} />} label="Spec only" />
          </Stack>
          {statusBlock}
        </Box>
      )}

      {/* Mode: Samples */}
      {mode === 3 && (
        <Box>
          <FormControlLabel sx={{ mb: 1 }} control={<Checkbox checked={specOnly} onChange={(e) => setSpecOnly(e.target.checked)} />} label="Spec only" />
          <SamplesGrid fixtures={fixtures} selected={selectedFixture} disabled={loading} onPick={(name) => { setSelectedFixture(name); void doFixture(name, selectedVersion); }} />
          {statusBlock}
        </Box>
      )}
    </Box>
  );
};

import { FC, useEffect, useRef, useState } from 'react';
import Editor, { DiffEditor, OnMount } from '@monaco-editor/react';
import {
  Box,
  Chip,
  Link,
  Stack,
  Tab,
  Tabs,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  Button,
  Tooltip,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DownloadIcon from '@mui/icons-material/Download';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import MemoryIcon from '@mui/icons-material/Memory';
import PublicIcon from '@mui/icons-material/Public';
import { useTheme } from '../../../../contexts/ThemeContext';
import { DisassembleResponse } from '../../../../api/dev-tools/dev-tools-api';

interface MonacoEditorLike {
  revealLineInCenter: (line: number) => void;
  setPosition: (pos: { lineNumber: number; column: number }) => void;
  focus: () => void;
}

interface OutputPanelProps {
  data: DisassembleResponse;
  /** When set, a "Diff" tab compares this original Rust against the decompiled output. */
  originalSource?: string;
  /** Provenance for address fetches. */
  provenance?: { network: string };
}

const EDITOR_HEIGHT = 460;

export const OutputPanel: FC<OutputPanelProps> = ({ data, originalSource, provenance }) => {
  const { themeMode } = useTheme();
  const [tab, setTab] = useState(0);
  const editorRef = useRef<MonacoEditorLike | null>(null);
  const [pendingLine, setPendingLine] = useState<number | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const regionRef = useRef<HTMLDivElement>(null);

  const monacoTheme = themeMode === 'dark' ? 'vs-dark' : 'light';

  const sections = data.sections ?? [];
  const warnings = data.warnings ?? [];
  const standardInterfaces = data.standard_interfaces ?? [];
  const functions = data.contract_info?.functions ?? [];
  const types = data.contract_info?.types ?? [];
  const functionCount = data.contract_info?.function_count ?? functions.length;
  const typeCount = data.contract_info?.type_count ?? types.length;
  const hasConstructor = data.contract_info?.has_constructor ?? false;

  const resultKey = `${data.wasm_hash ?? ''}-${data.wasm_size}-${data.elapsed_ms}-${data.source.length}`;

  // Move focus to the result when a new one arrives (screen-reader + keyboard).
  useEffect(() => {
    regionRef.current?.focus();
  }, [resultKey]);

  const copy = (text: string, what: string) => {
    void navigator.clipboard.writeText(text);
    setCopied(what);
    window.setTimeout(() => setCopied(null), 1500);
  };

  const download = (bytes: BlobPart, name: string, type: string) => {
    const blob = new Blob([bytes], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadWasm = () =>
    download(Uint8Array.from(atob(data.wasm_base64), (c) => c.charCodeAt(0)), 'contract.wasm', 'application/wasm');
  const downloadRust = () => download(data.source, 'contract.rs', 'text/x-rust');

  const tabs: { label: string; language: string; value: string }[] = [
    { label: 'Decompiled Rust', language: 'rust', value: data.source },
    { label: 'WAT', language: 'wasm', value: data.wat },
    { label: 'WASM (hex)', language: 'plaintext', value: data.wasm_hex },
  ];
  const hasDiff = !!originalSource;
  if (hasDiff) tabs.push({ label: 'Diff', language: 'rust', value: data.source });
  const active = tabs[Math.min(tab, tabs.length - 1)];
  const isDiff = hasDiff && tab === 3;

  const handleMount: OnMount = (ed) => {
    editorRef.current = ed as unknown as MonacoEditorLike;
  };

  const reveal = (line: number) => {
    const ed = editorRef.current;
    if (ed) {
      ed.revealLineInCenter(line);
      ed.setPosition({ lineNumber: line, column: 1 });
      ed.focus();
    }
  };
  const jumpTo = (line?: number | null) => {
    if (!line) return;
    if (tab !== 0) {
      setTab(0);
      setPendingLine(line);
    } else {
      reveal(line);
    }
  };
  // Jump the hex view to a byte offset (16 bytes/row; +3 for the truncation banner).
  const jumpToOffset = (offset: number) => {
    const headerLines = data.wasm_hex_truncated ? 3 : 0;
    const line = Math.floor(offset / 16) + 1 + headerLines;
    if (tab !== 2) {
      setTab(2);
      setPendingLine(line);
    } else {
      reveal(line);
    }
  };
  useEffect(() => {
    if (pendingLine != null && !isDiff) {
      const id = window.setTimeout(() => {
        reveal(pendingLine);
        setPendingLine(null);
      }, 60);
      return () => window.clearTimeout(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, pendingLine, isDiff]);

  const editorOptions = {
    readOnly: true,
    minimap: { enabled: false },
    fontSize: 13,
    scrollBeyondLastLine: false,
    automaticLayout: true,
    wordWrap: 'off' as const,
  };

  return (
    <Box sx={{ mt: 2 }} ref={regionRef} tabIndex={-1} role="region" aria-label="Disassembly result">
      <Box aria-live="polite" sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
        {data.is_soroban ? 'Soroban contract' : 'Generic WASM'} disassembled with soroban-ret {data.engine_version};{' '}
        {functionCount} functions, {typeCount} types.
      </Box>

      {/* Metadata summary */}
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
        <Chip
          size="small"
          color={data.is_soroban ? 'success' : 'default'}
          icon={data.is_soroban ? <CheckCircleOutlineIcon /> : <WarningAmberIcon />}
          label={data.is_soroban ? 'Soroban contract' : 'Generic WASM'}
        />
        <Chip size="small" color="primary" variant="outlined" icon={<MemoryIcon />} label={`soroban-ret v${data.engine_version} (${data.engine})`} />
        {provenance && <Chip size="small" color="secondary" variant="outlined" icon={<PublicIcon />} label={provenance.network} />}
        {data.sdk_version && <Chip size="small" variant="outlined" label={`SDK ${data.sdk_version.split('#')[0]}`} />}
        <Chip size="small" variant="outlined" label={`${data.wasm_size.toLocaleString()} bytes`} />
        <Chip size="small" variant="outlined" label={`${data.elapsed_ms} ms`} />
        <Chip size="small" variant="outlined" label={`${functionCount} functions`} />
        <Chip size="small" variant="outlined" label={`${typeCount} types`} />
        {hasConstructor && <Chip size="small" color="info" label="constructor" />}
        {standardInterfaces.map((si) => (
          <Chip key={si} size="small" color="primary" label={si} />
        ))}
      </Stack>

      {/* Provenance: full wasm hash with copy */}
      {data.wasm_hash && (
        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', mb: 1.5, flexWrap: 'wrap' }}>
          <Typography variant="caption" color="text.secondary">
            wasm hash:
          </Typography>
          <Typography variant="caption" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
            {data.wasm_hash}
          </Typography>
          <Tooltip title={copied === 'hash' ? 'Copied!' : 'Copy hash'} arrow>
            <IconButton size="small" onClick={() => copy(data.wasm_hash as string, 'hash')}>
              <ContentCopyIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Tooltip>
        </Stack>
      )}

      {warnings.length > 0 && (
        <Alert severity="warning" sx={{ mb: 1.5 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {warnings.length} validation {warnings.length === 1 ? 'warning' : 'warnings'}
          </Typography>
          <Box component="ul" sx={{ m: 0, pl: 2 }}>
            {warnings.slice(0, 8).map((w, i) => (
              <li key={i}>
                <Typography variant="caption">{w}</Typography>
              </li>
            ))}
          </Box>
        </Alert>
      )}

      {/* Output tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
        <Tabs value={Math.min(tab, tabs.length - 1)} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto" sx={{ flexGrow: 1, minHeight: 42 }}>
          {tabs.map((t) => (
            <Tab key={t.label} label={t.label} sx={{ textTransform: 'none', minHeight: 42 }} />
          ))}
        </Tabs>
        <Stack direction="row" spacing={0.5}>
          {!isDiff && (
            <Tooltip title={copied === 'src' ? 'Copied!' : 'Copy'} arrow>
              <Button size="small" startIcon={<ContentCopyIcon />} onClick={() => copy(active.value, 'src')}>
                Copy
              </Button>
            </Tooltip>
          )}
          <Tooltip title="Download decompiled .rs" arrow>
            <Button size="small" startIcon={<DownloadIcon />} onClick={downloadRust}>
              .rs
            </Button>
          </Tooltip>
          <Tooltip title="Download .wasm" arrow>
            <Button size="small" startIcon={<DownloadIcon />} onClick={downloadWasm}>
              .wasm
            </Button>
          </Tooltip>
        </Stack>
      </Box>

      {tab === 2 && data.wasm_hex_truncated && (
        <Alert severity="info" sx={{ borderRadius: 0 }}>
          Large module — hex view is truncated. Use the .wasm download for the full binary.
        </Alert>
      )}

      <Box sx={{ height: EDITOR_HEIGHT, border: 1, borderColor: 'divider', borderTop: 0, borderRadius: '0 0 6px 6px', overflow: 'hidden' }}>
        {isDiff ? (
          <DiffEditor
            key={`diff-${resultKey}`}
            height="100%"
            theme={monacoTheme}
            language="rust"
            original={originalSource}
            modified={data.source}
            // Avoid the "TextModel got disposed before DiffEditorWidget model got
            // reset" race in @monaco-editor/react by not disposing the models on
            // unmount.
            keepCurrentOriginalModel
            keepCurrentModifiedModel
            options={{ ...editorOptions, renderSideBySide: true }}
          />
        ) : (
          <Editor
            key={resultKey}
            height="100%"
            theme={monacoTheme}
            language={active.language}
            value={active.value}
            options={editorOptions}
            onMount={handleMount}
          />
        )}
      </Box>

      {/* Contract summary */}
      {(functions.length > 0 || types.length > 0) && (
        <Accordion sx={{ mt: 2 }} disableGutters defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography sx={{ fontWeight: 600 }}>
              Contract summary — {functionCount} functions, {typeCount} types
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            {functions.length > 0 && (
              <>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Functions{' '}
                  <Typography component="span" variant="caption" color="text.secondary">
                    (click to jump)
                  </Typography>
                </Typography>
                <Stack spacing={0.75} sx={{ mb: 2 }}>
                  {functions.map((f) => (
                    <Box key={f.name} sx={{ fontFamily: 'monospace', fontSize: 13, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Link component="button" type="button" underline="hover" onClick={() => jumpTo(f.line_number)} sx={{ fontFamily: 'monospace', fontSize: 13, textAlign: 'left' }} disabled={!f.line_number}>
                        <b>{f.name}</b>({f.params.map((p) => `${p.name}: ${p.type_name}`).join(', ')})
                        {f.return_type ? ` -> ${f.return_type}` : ''}
                      </Link>
                      {f.is_constructor && <Chip size="small" color="info" label="constructor" />}
                      {f.is_check_auth && <Chip size="small" color="secondary" label="__check_auth" />}
                      {!f.body_recovered && <Chip size="small" color="warning" variant="outlined" label="body not recovered" />}
                    </Box>
                  ))}
                </Stack>
              </>
            )}
            {types.length > 0 && (
              <>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Types
                </Typography>
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                  {types.map((t) => (
                    <Chip key={t.name} size="small" variant="outlined" clickable={!!t.line_number} onClick={() => jumpTo(t.line_number)} label={`${t.name} : ${t.kind}`} />
                  ))}
                </Stack>
              </>
            )}
          </AccordionDetails>
        </Accordion>
      )}

      {/* WASM sections — clickable to jump into the hex view */}
      {sections.length > 0 && (
        <Accordion disableGutters>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography sx={{ fontWeight: 600 }}>WASM sections ({sections.length})</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              Click a row to jump to its bytes in the hex view.
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Section</TableCell>
                  <TableCell align="right">Size (bytes)</TableCell>
                  <TableCell align="right">Offset</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sections.map((s, i) => (
                  <TableRow key={i} hover sx={{ cursor: 'pointer' }} onClick={() => jumpToOffset(s.offset)}>
                    <TableCell sx={{ fontFamily: 'monospace' }}>{s.name}</TableCell>
                    <TableCell align="right">{s.size.toLocaleString()}</TableCell>
                    <TableCell align="right" sx={{ fontFamily: 'monospace' }}>
                      0x{s.offset.toString(16)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </AccordionDetails>
        </Accordion>
      )}
    </Box>
  );
};

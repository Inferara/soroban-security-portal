import { FC, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import ApiIcon from '@mui/icons-material/Api';
import KeyIcon from '@mui/icons-material/Key';
import PeopleIcon from '@mui/icons-material/People';
import BlockIcon from '@mui/icons-material/Block';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlineOutlined';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import { BarChart } from '@mui/x-charts/BarChart';
import { useApiUsage } from './hooks/useApiUsage';
import { StatisticsCards } from '../../../../components/details';
import { SeverityColors } from '../../../../contexts/ThemeContext';
import { ApiKey, ApiKeyKind, ApiUsageSource, CreatedApiKey } from '../../../../api/soroban-security-portal/models/api-key';
import { ConfirmDialog } from '../admin-main-window/confirm-dialog';
import { useAuth } from 'react-oidc-context';
import { isAdmin } from '../../../authentication/authPermissions';

const sourceLabel = (source: ApiUsageSource): string => (source === ApiUsageSource.Mcp ? 'MCP' : 'REST');
const kindLabel = (kind: ApiKeyKind): string => (kind === ApiKeyKind.Service ? 'Service' : 'Personal');
const formatDate = (value: string | null): string => (value ? new Date(value).toLocaleString() : 'Never');

const parseLimit = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : NaN;
};

/**
 * Admin view of the public API / MCP usage: totals, calls per day, per tool and per key,
 * CSV export for reporting, and API key management including service keys.
 */
export const ApiUsage: FC = () => {
  const auth = useAuth();
  const admin = !auth.isLoading && isAdmin(auth);
  const { days, setDays, stats, keys, loading, error, reload, revokeKey, createServiceKey, downloadCsv } = useApiUsage(admin);

  const [keyToRevoke, setKeyToRevoke] = useState<ApiKey | null>(null);
  const [serviceOpen, setServiceOpen] = useState(false);
  const [serviceName, setServiceName] = useState('');
  const [servicePerMinute, setServicePerMinute] = useState('');
  const [servicePerDay, setServicePerDay] = useState('');
  const [busy, setBusy] = useState(false);
  const [createdKey, setCreatedKey] = useState<CreatedApiKey | null>(null);
  const [copied, setCopied] = useState(false);

  // The statistics hold callers' search text and key owners, so only admins may open this page.
  if (auth.isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;
  if (!admin) return <Alert severity="warning" sx={{ m: 2 }}>API usage is available to administrators only.</Alert>;
  if (loading && !stats) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;
  // Nothing loaded yet: there is no page to show, only the error and a way to retry.
  if (!stats) {
    return error ? (
      <Alert severity="error" sx={{ m: 2 }} action={<Button color="inherit" size="small" onClick={() => void reload()}>Retry</Button>}>
        {error}
      </Alert>
    ) : null;
  }

  const cards = [
    { icon: <ApiIcon sx={{ fontSize: 40 }} />, iconColor: SeverityColors['note'], value: stats.totalCalls, label: 'Calls' },
    { icon: <KeyIcon sx={{ fontSize: 40 }} />, iconColor: SeverityColors['low'], value: stats.activeKeys, label: 'Active keys', tooltip: 'Keys that made at least one call in the period' },
    { icon: <PeopleIcon sx={{ fontSize: 40 }} />, iconColor: SeverityColors['low'], value: stats.activeUsers, label: 'Active users', tooltip: 'Users whose keys made at least one call in the period' },
    { icon: <BlockIcon sx={{ fontSize: 40 }} />, iconColor: SeverityColors['medium'], value: stats.rateLimitedCalls, label: 'Rate limited', tooltip: 'Calls refused because a limit was reached' },
    { icon: <ErrorOutlineIcon sx={{ fontSize: 40 }} />, iconColor: SeverityColors['high'], value: stats.failedCalls, label: 'Errors', tooltip: 'Calls that failed on our side' },
  ];

  const xLabels = stats.daily.map((d) => d.date.substring(5, 10)); // MM-DD
  const perMinute = parseLimit(servicePerMinute);
  const perDay = parseLimit(servicePerDay);
  const serviceFormValid = serviceName.trim().length > 0 && !Number.isNaN(perMinute) && !Number.isNaN(perDay);

  const openServiceDialog = () => {
    setServiceName('');
    setServicePerMinute('');
    setServicePerDay('');
    setServiceOpen(true);
  };

  const handleCreateService = async () => {
    if (!serviceFormValid || busy) return;
    try {
      setBusy(true);
      const created = await createServiceKey({ name: serviceName.trim(), rateLimitPerMinute: perMinute, rateLimitPerDay: perDay });
      setServiceOpen(false);
      setCopied(false);
      setCreatedKey(created);
    } catch {
      // Error dialog already shown by the REST client.
    } finally {
      setBusy(false);
    }
  };

  const handleRevoke = async () => {
    if (!keyToRevoke) return;
    const id = keyToRevoke.id;
    setKeyToRevoke(null);
    try {
      await revokeKey(id);
    } catch {
      // Error dialog already shown.
    }
  };

  const handleCopy = async () => {
    if (!createdKey) return;
    try {
      await navigator.clipboard.writeText(createdKey.key);
      setCopied(true);
    } catch {
      // Clipboard can be blocked; the key stays selectable.
    }
  };

  return (
    <Box sx={{ p: { xs: 1, md: 2 } }}>
      {/* A failed refresh keeps the page, and any open one-time key dialog, on screen. */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={() => void reload()}>Retry</Button>}>
          {error}
        </Alert>
      )}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <Typography variant="body1">Period:</Typography>
        <Select size="small" value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Period">
          <MenuItem value={7}>Last 7 days</MenuItem>
          <MenuItem value={30}>Last 30 days</MenuItem>
          <MenuItem value={90}>Last 90 days</MenuItem>
          <MenuItem value={365}>Last 365 days</MenuItem>
        </Select>
        <Button variant="outlined" startIcon={<DownloadIcon />} onClick={() => void downloadCsv().catch(() => undefined)}>
          Export CSV
        </Button>
        {loading && <CircularProgress size={20} />}
      </Box>

      {stats.logRows > stats.maxExportRows && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          This period has {stats.logRows.toLocaleString()} log rows. The CSV export holds the newest{' '}
          {stats.maxExportRows.toLocaleString()} only; choose a shorter period to get every row.
        </Alert>
      )}

      <StatisticsCards cards={cards} columns={{ xs: 12, sm: 6, md: 2.4 }} />

      <Paper sx={{ p: 2, mt: 3 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>Calls per day</Typography>
        {stats.totalCalls > 0 ? (
          <BarChart
            height={280}
            xAxis={[{ scaleType: 'band', data: xLabels }]}
            series={[
              { data: stats.daily.map((d) => d.mcp), label: 'MCP', stack: 'calls', color: SeverityColors['note'] },
              { data: stats.daily.map((d) => d.rest), label: 'REST', stack: 'calls', color: SeverityColors['low'] },
            ]}
          />
        ) : (
          <Typography color="text.secondary">No calls in this period yet.</Typography>
        )}
      </Paper>

      <Paper sx={{ p: 2, mt: 3 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>Calls per tool</Typography>
        <Table size="small" aria-label="Calls per tool">
          <TableHead>
            <TableRow>
              <TableCell>Operation</TableCell>
              <TableCell>Source</TableCell>
              <TableCell align="right">Calls</TableCell>
              <TableCell align="right">Errors</TableCell>
              <TableCell align="right">Avg. time, ms</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {stats.byOperation.map((o) => (
              <TableRow key={`${o.operation}-${o.source}`}>
                <TableCell sx={{ fontFamily: 'monospace' }}>{o.operation}</TableCell>
                <TableCell>{sourceLabel(o.source)}</TableCell>
                <TableCell align="right">{o.calls}</TableCell>
                <TableCell align="right">{o.errors}</TableCell>
                <TableCell align="right">{o.averageDurationMs}</TableCell>
              </TableRow>
            ))}
            {stats.byOperation.length === 0 && (
              <TableRow><TableCell colSpan={5}>No data yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      <Paper sx={{ p: 2, mt: 3 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>Most active keys</Typography>
        <Table size="small" aria-label="Most active keys">
          <TableHead>
            <TableRow>
              <TableCell>Key</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Owner</TableCell>
              <TableCell align="right">Calls</TableCell>
              <TableCell>Last call</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {stats.byKey.map((k) => (
              <TableRow key={k.apiKeyId}>
                <TableCell>{k.name} <Typography component="span" variant="caption" sx={{ fontFamily: 'monospace' }}>{k.keyPrefix && `(${k.keyPrefix}…)`}</Typography></TableCell>
                <TableCell>{kindLabel(k.kind)}</TableCell>
                <TableCell>{k.ownerName || k.ownerLogin || (k.kind === ApiKeyKind.Service ? 'Partner' : '')}</TableCell>
                <TableCell align="right">{k.calls}</TableCell>
                <TableCell>{formatDate(k.lastCallAt)}</TableCell>
              </TableRow>
            ))}
            {stats.byKey.length === 0 && (
              <TableRow><TableCell colSpan={5}>No data yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      <Paper sx={{ p: 2, mt: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, gap: 2, flexWrap: 'wrap' }}>
            <Typography variant="h6">All API keys</Typography>
            <Button variant="contained" startIcon={<AddIcon />} onClick={openServiceDialog}>
              Issue service key
            </Button>
          </Box>
          <Table size="small" aria-label="All API keys">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Key</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Owner / issuer</TableCell>
                <TableCell>Limits (min / day)</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Last used</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {keys.map((key) => (
                <TableRow key={key.id} sx={{ opacity: key.revokedAt ? 0.55 : 1 }}>
                  <TableCell>{key.name}</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{key.keyPrefix}…</TableCell>
                  <TableCell>{kindLabel(key.kind)}</TableCell>
                  <TableCell>
                    {key.ownerName || key.ownerLogin || '(account removed)'}
                  </TableCell>
                  <TableCell>
                    {key.rateLimitPerMinute ?? 'default'} / {key.rateLimitPerDay ?? 'default'}
                  </TableCell>
                  <TableCell>{formatDate(key.createdAt)}</TableCell>
                  <TableCell>{formatDate(key.lastUsedAt)}</TableCell>
                  <TableCell>
                    {key.revokedAt ? <Chip size="small" label="Revoked" /> : <Chip size="small" color="success" label="Active" />}
                  </TableCell>
                  <TableCell align="right">
                    {!key.revokedAt && (
                      <Tooltip title="Revoke key">
                        <IconButton aria-label={`Revoke key ${key.name}`} size="small" onClick={() => setKeyToRevoke(key)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {keys.length === 0 && (
                <TableRow><TableCell colSpan={9}>No API keys have been created yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
      </Paper>

      {/* Issue service key */}
      <Dialog open={serviceOpen} onClose={() => !busy && setServiceOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Issue service key</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            A key for a partner integration. Its traffic is reported separately, and it can have its own limits.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            margin="dense"
            label="Name"
            placeholder="e.g. Stellar Raven"
            value={serviceName}
            onChange={(e) => setServiceName(e.target.value)}
            slotProps={{ htmlInput: { maxLength: 100 } }}
          />
          <TextField
            fullWidth
            margin="dense"
            label="Calls per minute"
            placeholder="Default"
            value={servicePerMinute}
            onChange={(e) => setServicePerMinute(e.target.value)}
            error={Number.isNaN(perMinute)}
            helperText={Number.isNaN(perMinute) ? 'Enter a whole number above 0, or leave empty.' : 'Leave empty to use the default limit.'}
          />
          <TextField
            fullWidth
            margin="dense"
            label="Calls per day"
            placeholder="Default"
            value={servicePerDay}
            onChange={(e) => setServicePerDay(e.target.value)}
            error={Number.isNaN(perDay)}
            helperText={Number.isNaN(perDay) ? 'Enter a whole number above 0, or leave empty.' : 'Leave empty to use the default limit.'}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setServiceOpen(false)} disabled={busy}>Cancel</Button>
          <Button variant="contained" onClick={() => void handleCreateService()} disabled={!serviceFormValid || busy}>
            {busy ? 'Issuing…' : 'Issue key'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Shown once */}
      <Dialog open={createdKey !== null} fullWidth maxWidth="sm">
        <DialogTitle>Service key issued</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Copy the key now and pass it to the partner over a secure channel. It cannot be shown again.
          </Alert>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TextField
              fullWidth
              size="small"
              label="API key"
              value={createdKey?.key ?? ''}
              slotProps={{ htmlInput: { readOnly: true, style: { fontFamily: 'monospace' }, 'aria-label': 'New API key' } }}
              onFocus={(e) => e.target.select()}
            />
            <Button variant="outlined" startIcon={copied ? <CheckIcon /> : <ContentCopyIcon />} onClick={() => void handleCopy()} sx={{ whiteSpace: 'nowrap' }}>
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setCreatedKey(null)}>Done</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        title="Revoke API key"
        message={`Revoke "${keyToRevoke?.name ?? ''}" of ${keyToRevoke?.ownerName || keyToRevoke?.ownerLogin || 'a removed account'}? Anything using it stops working immediately. This cannot be undone.`}
        okButtonText="Revoke"
        cancelButtonText="Cancel"
        show={keyToRevoke !== null}
        onConfirm={() => void handleRevoke()}
        onCancel={() => setKeyToRevoke(null)}
      />
    </Box>
  );
};

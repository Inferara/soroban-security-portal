import { FC, useCallback, useEffect, useState } from 'react';
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
  Link,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import { Link as RouterLink } from 'react-router-dom';
import { ApiKey, ApiLimits, CreatedApiKey } from '../../../../api/soroban-security-portal/models/api-key';
import {
  createApiKeyCall,
  getApiKeysCall,
  getApiLimitsCall,
  revokeApiKeyCall,
} from '../../../../api/soroban-security-portal/soroban-security-portal-api';
import { ConfirmDialog } from '../../admin/admin-main-window/confirm-dialog';
import { CodeBlock } from '../../../../components/CodeBlock';
import { claudeCodeSnippet } from '../developers/connection-snippets';
import { environment } from '../../../../environments/environment';

const formatDate = (value: string | null): string => (value ? new Date(value).toLocaleString() : 'Never');

/**
 * "API keys" tab of the user's own profile: create, list and revoke keys for the
 * public API and the MCP server. A new key is shown once, in a dialog, and never again.
 */
export const ApiKeysSection: FC = () => {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [limits, setLimits] = useState<ApiLimits | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createdKey, setCreatedKey] = useState<CreatedApiKey | null>(null);
  const [copied, setCopied] = useState(false);

  const [keyToRevoke, setKeyToRevoke] = useState<ApiKey | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(false);
      const [loadedKeys, loadedLimits] = await Promise.all([getApiKeysCall(), getApiLimitsCall()]);
      setKeys(loadedKeys);
      setLimits(loadedLimits);
    } catch {
      // The REST client has already shown the error dialog.
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const activeKeys = keys.filter((k) => !k.revokedAt);
  const atLimit = limits !== null && activeKeys.length >= limits.maxKeysPerUser;

  const openCreate = () => {
    setNewName('');
    setCreateOpen(true);
  };

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name || creating) return;
    try {
      setCreating(true);
      const created = await createApiKeyCall(name);
      setCreateOpen(false);
      setCopied(false);
      setCreatedKey(created);
      await load();
    } catch {
      // Error dialog already shown; keep the form open so the name is not lost.
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async () => {
    if (!createdKey) return;
    try {
      await navigator.clipboard.writeText(createdKey.key);
      setCopied(true);
    } catch {
      // Clipboard can be blocked; the key stays selectable in the text field.
    }
  };

  const handleRevoke = async () => {
    if (!keyToRevoke) return;
    const id = keyToRevoke.id;
    setKeyToRevoke(null);
    try {
      await revokeApiKeyCall(id);
      await load();
    } catch {
      // Error dialog already shown.
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', mb: 2 }}>
        <Box sx={{ maxWidth: 760 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
            API keys
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Use a key to connect an AI agent (Claude Code, Cursor and others) to the portal through MCP, or to call the
            public REST API. Keys are read-only: they can search and read findings and reports, nothing else.{' '}
            <Link component={RouterLink} to={`${environment.basePath}/developers`}>
              How to connect
            </Link>
          </Typography>
          {limits && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Limits per key: {limits.rateLimitPerMinute} calls per minute, {limits.rateLimitPerDay.toLocaleString()} calls
              per day. Up to {limits.maxKeysPerUser} active keys.
            </Typography>
          )}
        </Box>
        <Tooltip title={atLimit ? `You have ${limits?.maxKeysPerUser} active keys. Revoke one to create another.` : ''}>
          <span>
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate} disabled={loading || loadError || atLimit}>
              Create API key
            </Button>
          </span>
        </Tooltip>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : loadError ? (
        <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => void load()}>Retry</Button>}>
          Could not load your API keys.
        </Alert>
      ) : keys.length === 0 ? (
        <Alert severity="info">You have no API keys yet. Create one to connect your agent.</Alert>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small" aria-label="API keys">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Key</TableCell>
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
                  <TableCell>{formatDate(key.createdAt)}</TableCell>
                  <TableCell>{formatDate(key.lastUsedAt)}</TableCell>
                  <TableCell>
                    {key.revokedAt ? (
                      <Chip size="small" label="Revoked" />
                    ) : (
                      <Chip size="small" color="success" label="Active" />
                    )}
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
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Create */}
      <Dialog open={createOpen} onClose={() => !creating && setCreateOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Create API key</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            margin="dense"
            label="Key name"
            placeholder="e.g. Claude Code on my laptop"
            helperText="A label for you, so you can tell your keys apart."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleCreate();
            }}
            slotProps={{ htmlInput: { maxLength: 100 } }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)} disabled={creating}>
            Cancel
          </Button>
          <Button variant="contained" onClick={() => void handleCreate()} disabled={!newName.trim() || creating}>
            {creating ? 'Creating…' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Shown once */}
      <Dialog open={createdKey !== null} fullWidth maxWidth="md">
        <DialogTitle>Your new API key</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Copy the key now. For your security it is not stored in readable form and cannot be shown again.
          </Alert>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
            <TextField
              fullWidth
              size="small"
              label="API key"
              value={createdKey?.key ?? ''}
              slotProps={{ htmlInput: { readOnly: true, style: { fontFamily: 'monospace' }, 'aria-label': 'New API key' } }}
              onFocus={(e) => e.target.select()}
            />
            <Button
              variant="outlined"
              startIcon={copied ? <CheckIcon /> : <ContentCopyIcon />}
              onClick={() => void handleCopy()}
              sx={{ whiteSpace: 'nowrap' }}
            >
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Connect Claude Code
          </Typography>
          <CodeBlock className="language-bash">{claudeCodeSnippet(createdKey?.key)}</CodeBlock>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Other clients and the REST API are covered in the{' '}
            <Link component={RouterLink} to={`${environment.basePath}/developers`} target="_blank" rel="noopener">
              connection guide
            </Link>
            .
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setCreatedKey(null)}>
            Done
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        title="Revoke API key"
        message={`Revoke "${keyToRevoke?.name ?? ''}"? Anything using this key stops working immediately. This cannot be undone.`}
        okButtonText="Revoke"
        cancelButtonText="Cancel"
        show={keyToRevoke !== null}
        onConfirm={() => void handleRevoke()}
        onCancel={() => setKeyToRevoke(null)}
      />
    </Box>
  );
};

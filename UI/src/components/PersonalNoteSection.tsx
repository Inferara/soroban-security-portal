import { FC, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  LockOutlined as LockOutlinedIcon,
  NoteAlt as NoteAltIcon,
} from '@mui/icons-material';
import { PersonalNote } from '../api/soroban-security-portal/models/personal-note';
import {
  deletePersonalNoteByVulnerabilityCall,
  getPersonalNoteByVulnerabilityCall,
  savePersonalNoteCall,
} from '../api/soroban-security-portal/soroban-security-portal-api';
import { useAppAuth } from '../features/authentication/useAppAuth';
import { useTheme as useAppTheme } from '../contexts/ThemeContext';
import { MarkdownView } from './MarkdownView';
import { showError, showSuccess } from '../features/dialog-handler/dialog-handler';

export const MAX_PERSONAL_NOTE_LENGTH = 10000;

interface PersonalNoteSectionProps {
  vulnerabilityId: number;
  compact?: boolean;
}

export const PersonalNoteSection: FC<PersonalNoteSectionProps> = ({
  vulnerabilityId,
  compact = false,
}) => {
  const { isAuthenticated } = useAppAuth();
  const { themeMode } = useAppTheme();

  const [note, setNote] = useState<PersonalNote | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const activeVulnerabilityIdRef = useRef<number>(vulnerabilityId);
  const loadRequestIdRef = useRef<number>(0);
  const mutationRequestIdRef = useRef<number>(0);

  useEffect(() => {
    activeVulnerabilityIdRef.current = vulnerabilityId;
    const requestId = ++loadRequestIdRef.current;
    mutationRequestIdRef.current += 1;

    setNote(null);
    setDraft('');
    setEditing(false);
    setError(null);
    setSaving(false);

    if (!isAuthenticated || vulnerabilityId <= 0) {
      setLoading(false);
      return;
    }

    const targetVulnerabilityId = vulnerabilityId;
    setLoading(true);

    void (async () => {
      try {
        const existing = await getPersonalNoteByVulnerabilityCall(targetVulnerabilityId);
        if (
          loadRequestIdRef.current !== requestId ||
          activeVulnerabilityIdRef.current !== targetVulnerabilityId
        ) {
          return;
        }
        setNote(existing);
        setDraft(existing?.content ?? '');
        setEditing(false);
      } catch (err: unknown) {
        if (
          loadRequestIdRef.current !== requestId ||
          activeVulnerabilityIdRef.current !== targetVulnerabilityId
        ) {
          return;
        }
        const message = err instanceof Error ? err.message : 'Failed to load personal note';
        setError(message);
      } finally {
        if (
          loadRequestIdRef.current === requestId &&
          activeVulnerabilityIdRef.current === targetVulnerabilityId
        ) {
          setLoading(false);
        }
      }
    })();

    return () => {
      loadRequestIdRef.current += 1;
    };
  }, [isAuthenticated, vulnerabilityId]);

  if (!isAuthenticated || vulnerabilityId <= 0) {
    return null;
  }

  const handleStartAdd = () => {
    setDraft('');
    setError(null);
    setEditing(true);
  };

  const handleStartEdit = () => {
    setDraft(note?.content ?? '');
    setError(null);
    setEditing(true);
  };

  const handleCancel = () => {
    setDraft(note?.content ?? '');
    setError(null);
    setEditing(false);
  };

  const handleSave = async () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      setError('Note content cannot be empty.');
      return;
    }
    if (trimmed.length > MAX_PERSONAL_NOTE_LENGTH) {
      setError(`Note content must not exceed ${MAX_PERSONAL_NOTE_LENGTH} characters.`);
      return;
    }

    const targetVulnerabilityId = vulnerabilityId;
    const mutationId = ++mutationRequestIdRef.current;
    loadRequestIdRef.current += 1;

    setSaving(true);
    setError(null);
    try {
      const saved = await savePersonalNoteCall(targetVulnerabilityId, trimmed);
      if (
        mutationRequestIdRef.current !== mutationId ||
        activeVulnerabilityIdRef.current !== targetVulnerabilityId
      ) {
        return;
      }
      setNote(saved);
      setDraft(saved.content);
      setEditing(false);
      showSuccess('Personal note saved');
    } catch (err: unknown) {
      if (
        mutationRequestIdRef.current !== mutationId ||
        activeVulnerabilityIdRef.current !== targetVulnerabilityId
      ) {
        return;
      }
      const message = err instanceof Error ? err.message : 'Failed to save personal note';
      setError(message);
      showError('Failed to save personal note');
    } finally {
      if (
        mutationRequestIdRef.current === mutationId &&
        activeVulnerabilityIdRef.current === targetVulnerabilityId
      ) {
        setSaving(false);
      }
    }
  };

  const handleDelete = async () => {
    if (!note) return;

    const targetVulnerabilityId = vulnerabilityId;
    const mutationId = ++mutationRequestIdRef.current;
    loadRequestIdRef.current += 1;

    setSaving(true);
    setError(null);
    try {
      await deletePersonalNoteByVulnerabilityCall(targetVulnerabilityId);
      if (
        mutationRequestIdRef.current !== mutationId ||
        activeVulnerabilityIdRef.current !== targetVulnerabilityId
      ) {
        return;
      }
      setNote(null);
      setDraft('');
      setEditing(false);
      showSuccess('Personal note deleted');
    } catch (err: unknown) {
      if (
        mutationRequestIdRef.current !== mutationId ||
        activeVulnerabilityIdRef.current !== targetVulnerabilityId
      ) {
        return;
      }
      const message = err instanceof Error ? err.message : 'Failed to delete personal note';
      setError(message);
      showError('Failed to delete personal note');
    } finally {
      if (
        mutationRequestIdRef.current === mutationId &&
        activeVulnerabilityIdRef.current === targetVulnerabilityId
      ) {
        setSaving(false);
      }
    }
  };

  const innerContent = (
    <Box>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 1,
          mb: 1.5,
        }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <NoteAltIcon color="primary" fontSize={compact ? 'small' : 'medium'} />
          <Typography
            variant={compact ? 'subtitle1' : 'h6'}
            sx={{ fontWeight: 600 }}
          >
            Personal Note
          </Typography>
          <Chip
            icon={<LockOutlinedIcon sx={{ fontSize: '0.85rem !important' }} />}
            label="Visible only to you"
            size="small"
            variant="outlined"
            sx={{ fontSize: '0.75rem', height: 22 }}
          />
        </Stack>

        {!loading && !editing && note && (
          <Stack direction="row" spacing={0.5}>
            <IconButton
              size="small"
              onClick={handleStartEdit}
              disabled={saving}
              title="Edit personal note"
              aria-label="Edit personal note"
            >
              <EditIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              color="error"
              onClick={() => void handleDelete()}
              disabled={saving}
              title="Delete personal note"
              aria-label="Delete personal note"
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Stack>
        )}

        {!loading && !editing && !note && (
          <Button
            size="small"
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={handleStartAdd}
          >
            Add Personal Note
          </Button>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1 }}>
          <CircularProgress size={18} />
          <Typography variant="body2" color="text.secondary">
            Loading your personal note...
          </Typography>
        </Box>
      ) : editing ? (
        <Box>
          <TextField
            fullWidth
            multiline
            minRows={compact ? 3 : 4}
            maxRows={10}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write your private notes, audit findings, or follow-up checklist for this vulnerability (Markdown supported)..."
            disabled={saving}
            slotProps={{
              htmlInput: {
                maxLength: MAX_PERSONAL_NOTE_LENGTH,
                'aria-label': 'Personal note content',
              },
            }}
            sx={{ mb: 1 }}
          />
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 1,
            }}
          >
            <Typography variant="caption" color="text.secondary">
              {draft.length} / {MAX_PERSONAL_NOTE_LENGTH} characters
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                variant="text"
                onClick={handleCancel}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                size="small"
                variant="contained"
                onClick={() => void handleSave()}
                disabled={saving || !draft.trim()}
              >
                {saving ? 'Saving...' : 'Save Note'}
              </Button>
            </Stack>
          </Box>
        </Box>
      ) : note ? (
        <Box>
          <Paper
            sx={{
              p: 2,
              backgroundColor: themeMode === 'light' ? '#fafafa' : '#13131c',
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <MarkdownView content={note.content} sx={{ p: 0 }} />
          </Paper>
          {note.updatedAt && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', mt: 0.75, textAlign: 'right' }}
            >
              Updated: {new Date(note.updatedAt).toLocaleString()}
            </Typography>
          )}
        </Box>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
          No personal note yet. Add a private note for this vulnerability — it will also appear in your Profile under My Notes.
        </Typography>
      )}
    </Box>
  );

  if (compact) {
    return (
      <Paper
        sx={{
          p: 2,
          mb: 2,
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          backgroundColor: themeMode === 'light' ? '#ffffff' : '#181824',
        }}
      >
        {innerContent}
      </Paper>
    );
  }

  return (
    <Card sx={{ mb: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
      <CardContent>{innerContent}</CardContent>
    </Card>
  );
};

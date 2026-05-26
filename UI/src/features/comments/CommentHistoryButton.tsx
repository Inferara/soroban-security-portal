import { FC, useState } from 'react';
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Box,
  CircularProgress,
  Divider,
} from '@mui/material';
import HistoryIcon from '@mui/icons-material/History';
import { MarkdownView } from '../../components/MarkdownView';
import { CommentEditHistoryEntry } from '../../api/soroban-security-portal/models/comment';
import { getCommentHistoryCall } from '../../api/soroban-security-portal/soroban-security-portal-api';

interface CommentHistoryButtonProps {
  commentId: number;
}

// Moderator/admin-only: shows the previous versions of an edited comment.
export const CommentHistoryButton: FC<CommentHistoryButtonProps> = ({ commentId }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<CommentEditHistoryEntry[] | null>(null);
  const [error, setError] = useState(false);

  const handleOpen = async () => {
    setOpen(true);
    setLoading(true);
    setError(false);
    try {
      setEntries(await getCommentHistoryCall(commentId));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button size="small" startIcon={<HistoryIcon fontSize="small" />} onClick={handleOpen}>
        History
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Edit history</DialogTitle>
        <DialogContent dividers>
          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <CircularProgress size={24} />
            </Box>
          )}
          {!loading && error && (
            <Typography color="error">Failed to load edit history.</Typography>
          )}
          {!loading && !error && entries && entries.length === 0 && (
            <Typography color="text.secondary">No previous versions recorded.</Typography>
          )}
          {!loading && !error && entries && entries.length > 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {entries
                .slice()
                .reverse()
                .map((e, i) => (
                  <Box key={`${e.editedAt}-${i}`}>
                    <Typography variant="caption" color="text.secondary">
                      Version from {new Date(e.editedAt).toLocaleString()}
                    </Typography>
                    <MarkdownView content={e.previousContent} sx={{ p: 0, mt: 0.5 }} />
                    {i < entries.length - 1 && <Divider sx={{ mt: 1.5 }} />}
                  </Box>
                ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

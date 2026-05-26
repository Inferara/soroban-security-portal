import { FC, useState } from 'react';
import { Box, Button, Stack } from '@mui/material';
import { MarkdownEditor } from '../../components/MarkdownEditor';

interface CommentEditorProps {
  onSubmit: (content: string) => Promise<boolean>;
  onCancel?: () => void;
  submitLabel?: string;
  placeholder?: string;
  autoFocus?: boolean;
}

export const CommentEditor: FC<CommentEditorProps> = ({ onSubmit, onCancel, submitLabel = 'Comment' }) => {
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim() || submitting) return;
    setSubmitting(true);
    const ok = await onSubmit(content);
    setSubmitting(false);
    if (ok) setContent('');
  };

  return (
    <Box sx={{ mb: 2 }}>
      <MarkdownEditor value={content} onChange={setContent} label="Comment" height="20vh" />
      <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
        <Button variant="contained" onClick={handleSubmit} disabled={!content.trim() || submitting}>
          {submitting ? 'Posting…' : submitLabel}
        </Button>
        {onCancel && <Button onClick={onCancel} disabled={submitting}>Cancel</Button>}
      </Stack>
    </Box>
  );
};

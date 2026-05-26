import { FC, useState } from 'react';
import { Box, Button, Stack } from '@mui/material';
import type { Monaco } from '@monaco-editor/react';
import { MarkdownEditor } from '../../components/MarkdownEditor';
import { searchUsersCall } from '../../api/soroban-security-portal/soroban-security-portal-api';

// Module-level guard so React re-renders don't stack multiple providers.
let mentionProviderRegistered = false;

// NOTE: This provider is browser-verified only — Monaco is mocked in jsdom and
// beforeMount will not fire during unit tests.
const registerMentionProvider = (monaco: Monaco) => {
  if (mentionProviderRegistered) return;
  mentionProviderRegistered = true;
  monaco.languages.registerCompletionItemProvider('markdown', {
    triggerCharacters: ['@'],
    provideCompletionItems: async (model: Monaco['editor']['ITextModel'], position: Monaco['editor']['IPosition']) => {
      const line = model.getLineContent(position.lineNumber).slice(0, position.column - 1);
      const match = /@([a-zA-Z0-9_.-]*)$/.exec(line);
      if (!match) return { suggestions: [] };
      const query = match[1];
      // Replace the whole "@token" (including the '@') so Monaco filters the
      // typed text against the "@username" label/filterText — otherwise the
      // leading '@' in the label breaks the match and nothing is shown.
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: position.column - query.length - 1, // include the '@'
        endColumn: position.column,
      };
      const users = await searchUsersCall(query).catch(() => [] as { id: number; displayName: string; username: string }[]);
      return {
        suggestions: users.map((u) => ({
          label: `@${u.username}`,
          kind: monaco.languages.CompletionItemKind.User,
          detail: u.displayName,
          insertText: `@${u.username} `,
          filterText: `@${u.username}`,
          range,
        })),
      };
    },
  });
};

interface CommentEditorProps {
  onSubmit: (content: string) => Promise<boolean>;
  onCancel?: () => void;
  submitLabel?: string;
  initialValue?: string;
}

export const CommentEditor: FC<CommentEditorProps> = ({ onSubmit, onCancel, submitLabel = 'Comment', initialValue }) => {
  const [content, setContent] = useState(initialValue ?? '');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim() || submitting) return;
    setSubmitting(true);
    try {
      const ok = await onSubmit(content);
      if (ok) setContent('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ mb: 2 }}>
      <MarkdownEditor
        value={content}
        onChange={setContent}
        label="Comment"
        height="20vh"
        beforeMount={registerMentionProvider}
      />
      <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
        <Button variant="contained" onClick={handleSubmit} disabled={!content.trim() || submitting}>
          {submitting ? 'Posting…' : submitLabel}
        </Button>
        {onCancel && <Button onClick={onCancel} disabled={submitting}>Cancel</Button>}
      </Stack>
    </Box>
  );
};

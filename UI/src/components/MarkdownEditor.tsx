import { FC, useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { Box, Typography, Tabs, Tab, useTheme } from '@mui/material';
import { Editor } from '@monaco-editor/react';
import { useTheme as useThemeContext } from '../contexts/ThemeContext';
import { MarkdownView } from './MarkdownView';
import { searchUsersCall } from '../api/soroban-security-portal/soroban-security-portal-api';
import { UserSearchResult } from '../api/soroban-security-portal/models/user';
import { debounce } from 'lodash';
import type { editor } from 'monaco-editor';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  height?: string;
  required?: boolean;
}

export const MarkdownEditor: FC<MarkdownEditorProps> = ({
  value,
  onChange,
  label = 'Description',
  height = '40vh',
  required = false,
}) => {
  const { themeMode } = useThemeContext();
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  const debouncedSearchFn = useMemo(
    () =>
      debounce(async (q: string): Promise<UserSearchResult[]> => {
        if (q.length < 2) {
          return [];
        }
        try {
          return await searchUsersCall(q, 5);
        } catch (error) {
          console.error('Error searching users:', error);
          return [];
        }
      }, 300),
    []
  );

  useEffect(() => {
    return () => {
      debouncedSearchFn.cancel();
    };
  }, [debouncedSearchFn]);

  const debouncedSearchUsers = useCallback(
    (query: string): Promise<UserSearchResult[]> => {
      const result = debouncedSearchFn(query);
      return result ?? Promise.resolve([]);
    },
    [debouncedSearchFn]
  );

  // Handle editor mount
  const handleEditorDidMount = useCallback((editorInstance: editor.IStandaloneCodeEditor, monaco: any) => {
    editorRef.current = editorInstance;

    // Register completion provider for @ mentions
    monaco.languages.registerCompletionItemProvider('markdown', {
      triggerCharacters: ['@'],
      provideCompletionItems: async (model: editor.ITextModel, position: unknown) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pos = position as any;
        const lineContent = model.getLineContent(pos.lineNumber);
        const textBeforeCursor = lineContent.substring(0, pos.column - 1);

        // Check if we're in an @ mention
        const atIndex = textBeforeCursor.lastIndexOf('@');
        if (atIndex === -1) return { suggestions: [] };

        const query = textBeforeCursor.substring(atIndex + 1);
        if (query.length === 0) return { suggestions: [] };

        const users = await debouncedSearchUsers(query);

        const suggestions = users.map((user, index) => ({
          label: `@${user.login}`,
          kind: monaco.languages.CompletionItemKind.User,
          detail: user.fullName,
          insertText: `@${user.login} `,
          range: {
            startLineNumber: pos.lineNumber,
            endLineNumber: pos.lineNumber,
            startColumn: atIndex + 1,
            endColumn: pos.column
          },
          sortText: `${index.toString().padStart(3, '0')}`,
          documentation: {
            value: `**${user.fullName}**\n@${user.login}`
          }
        }));

        return { suggestions };
      }
    });
  }, [debouncedSearchUsers]);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography sx={{ fontWeight: 600, color: theme.palette.text.primary }}>
          {label}{required && ' *'}
        </Typography>
        <Tabs 
          value={activeTab} 
          onChange={(_, newValue) => setActiveTab(newValue)}
          sx={{ minHeight: 36 }}
        >
          <Tab label="Editor" sx={{ minHeight: 36, py: 0.5, textTransform: 'none' }} />
          <Tab label="Preview" sx={{ minHeight: 36, py: 0.5, textTransform: 'none' }} />
        </Tabs>
      </Box>
      <Box sx={{ 
        border: `1px solid ${theme.palette.divider}`, 
        borderRadius: 1,
        overflow: 'hidden'
      }}>
        {activeTab === 0 ? (
          <Editor
            height={height}
            language="markdown"
            value={value}
            theme={themeMode === 'light' ? 'vs' : 'vs-dark'}
            onChange={(newValue) => onChange(newValue ?? '')}
            onMount={handleEditorDidMount}
            options={{
              wordWrap: 'on',
              wrappingIndent: 'indent',
            }}
          />
        ) : (
          <MarkdownView 
            content={value}
            emptyMessage="No content to preview. Start typing in the Editor tab."
            minHeight={height}
            background={{ 
              p: 3,
              bgcolor: theme.palette.background.paper 
            }}
          />
        )}
      </Box>
    </Box>
  );
};

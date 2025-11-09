import { FC, useState } from 'react';
import { Box, Typography, Tabs, Tab, useTheme } from '@mui/material';
import { Editor } from '@monaco-editor/react';
import { useTheme as useThemeContext } from '../contexts/ThemeContext';
import { MarkdownView } from './MarkdownView';

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

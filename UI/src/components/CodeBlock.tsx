import React, { useState } from 'react';
import { Box, IconButton, Typography, Tooltip } from '@mui/material';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { materialDark, materialLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import { useTheme } from '../contexts/ThemeContext';

interface CodeBlockProps {
  children: string;
  className?: string;
  inline?: boolean;
  [key: string]: unknown; // Allow additional props from ReactMarkdown
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ children, className, inline = false, ...props }) => {
  const [copied, setCopied] = useState(false);
  const { themeMode } = useTheme();
  
  // Extract language from className (format: "language-{lang}")
  const language = className?.replace('language-', '') || 'text';
  
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  const getLanguageDisplayName = (lang: string) => {
    const languageMap: Record<string, string> = {
      'js': 'JavaScript',
      'javascript': 'JavaScript',
      'ts': 'TypeScript',
      'typescript': 'TypeScript',
      'jsx': 'JSX',
      'tsx': 'TSX',
      'html': 'HTML',
      'css': 'CSS',
      'scss': 'SCSS',
      'sass': 'Sass',
      'json': 'JSON',
      'xml': 'XML',
      'yaml': 'YAML',
      'yml': 'YAML',
      'bash': 'Bash',
      'shell': 'Shell',
      'sh': 'Shell',
      'python': 'Python',
      'py': 'Python',
      'java': 'Java',
      'c': 'C',
      'cpp': 'C++',
      'csharp': 'C#',
      'cs': 'C#',
      'php': 'PHP',
      'ruby': 'Ruby',
      'go': 'Go',
      'rust': 'Rust',
      'sql': 'SQL',
      'markdown': 'Markdown',
      'md': 'Markdown',
      'dockerfile': 'Dockerfile',
      'docker': 'Docker',
      'gitignore': 'Git Ignore',
      'env': 'Environment Variables',
      'ini': 'INI',
      'toml': 'TOML',
      'text': 'Text'
    };
    
    return languageMap[lang.toLowerCase()] || lang;
  };

  // Handle inline code
  if (inline) {
    return (
      <code
        className={className}
        {...props}
        style={{
          backgroundColor: themeMode === 'light' ? '#f0f0f0' : '#2d2d2d',
          color: themeMode === 'light' ? '#d63384' : '#ff6b6b',
          padding: '2px 6px',
          borderRadius: '4px',
          fontSize: '0.875em',
          fontFamily: 'Consolas, Monaco, "Andale Mono", "Ubuntu Mono", monospace',
          border: '1px solid',
          borderColor: themeMode === 'light' ? '#e0e0e0' : '#444'
        }}
      >
        {children}
      </code>
    );
  }

  return (
    <Box
      sx={{
        position: 'relative',
        borderRadius: 2,
        overflow: 'hidden',
        border: '1px solid',
        borderColor: 'divider',
        my: 2,
        backgroundColor: themeMode === 'light' ? '#f5f5f5' : '#1e1e1e',
        boxShadow: themeMode === 'light' 
          ? '0 2px 8px rgba(0,0,0,0.1)' 
          : '0 2px 8px rgba(0,0,0,0.3)'
      }}
    >
      {/* Header with language and copy button */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          px: 2,
          py: 1,
          backgroundColor: themeMode === 'light' ? '#e0e0e0' : '#2d2d2d',
          borderBottom: '1px solid',
          borderColor: 'divider'
        }}
      >
        <Typography
          variant="caption"
          sx={{
            fontWeight: 600,
            color: themeMode === 'light' ? 'text.secondary' : 'text.primary',
            textTransform: 'uppercase',
            letterSpacing: 0.5
          }}
        >
          {getLanguageDisplayName(language)}
        </Typography>
        <Tooltip title={copied ? 'Copied!' : 'Copy code'}>
          <IconButton
            size="small"
            onClick={handleCopy}
            sx={{
              color: copied ? 'success.main' : 'text.secondary',
              '&:hover': {
                backgroundColor: 'action.hover'
              }
            }}
          >
            {copied ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Box>
      
      {/* Code content */}
      <Box sx={{ maxHeight: '400px', overflow: 'auto' }}>
        <SyntaxHighlighter
          language={language === 'text' ? undefined : language}
          style={themeMode === 'light' ? materialLight : materialDark}
          customStyle={{
            margin: 0,
            padding: '16px',
            fontSize: '14px',
            lineHeight: 1.5,
            backgroundColor: themeMode === 'light' ? '#e0e0e0' : '#2F2F2F'
          }}
          showLineNumbers={language !== 'text'}
          wrapLines={true}
          lineNumberStyle={{
            color: themeMode === 'light' ? '#999' : '#666',
            fontSize: '12px',
            minWidth: '3em'
          }}
        >
          {children.trim()}
        </SyntaxHighlighter>
      </Box>
    </Box>
  );
};
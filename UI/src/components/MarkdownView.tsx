import { FC } from 'react';
import { Box, Typography, useTheme, SxProps, Theme } from '@mui/material';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeKatex from 'rehype-katex';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkRehype from 'remark-rehype';
import { CodeBlock } from './CodeBlock';
import 'katex/dist/katex.min.css';

/**
 * Custom sanitization schema based on GitHub's defaults.
 * Allows safe HTML elements needed for markdown rendering while blocking XSS vectors.
 *
 * Blocked: script, style, iframe, object, embed, form, input, event handlers (onclick, onerror, etc.)
 * Allowed: Standard markdown elements, tables, images, links, code blocks, KaTeX math
 */
const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [
    // Block elements
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'div', 'span', 'br', 'hr',
    'blockquote', 'pre', 'code',
    // Lists
    'ul', 'ol', 'li',
    // Tables
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
    // Inline elements
    'a', 'strong', 'b', 'em', 'i', 'u', 's', 'del', 'ins',
    'sub', 'sup', 'mark', 'small',
    // Media (with src restrictions below)
    'img',
    // KaTeX math elements
    'math', 'semantics', 'mrow', 'mi', 'mo', 'mn', 'msup', 'msub',
    'mfrac', 'mroot', 'msqrt', 'mover', 'munder', 'munderover',
    'mtable', 'mtr', 'mtd', 'mtext', 'mspace', 'annotation',
  ],
  attributes: {
    ...defaultSchema.attributes,
    // Allow class on all elements for styling (code highlighting, KaTeX)
    '*': ['className', 'class', 'style'],
    // Links - allow href but protocols are restricted below
    a: ['href', 'title', 'target', 'rel'],
    // Images - allow src but protocols are restricted below
    img: ['src', 'alt', 'title', 'width', 'height'],
    // Code blocks
    code: ['className', 'class'],
    pre: ['className', 'class'],
    // Table elements
    th: ['scope', 'colspan', 'rowspan'],
    td: ['colspan', 'rowspan'],
    // KaTeX specific attributes
    math: ['xmlns', 'display'],
    annotation: ['encoding'],
  },
  // Only allow safe URL protocols
  protocols: {
    href: ['http', 'https', 'mailto'],
    src: ['http', 'https', 'data'],
  },
  // Strip all event handlers and dangerous attributes
  strip: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'textarea'],
};

interface MarkdownViewProps {
  content: string;
  emptyMessage?: string;
  minHeight?: string | number;
  background?: SxProps<Theme>;
  sx?: SxProps<Theme>;
}
export const MarkdownView: FC<MarkdownViewProps> = ({ 
  content, 
  emptyMessage = 'No content to preview',
  minHeight,
  background,
  sx = {},
}) => {
  const theme = useTheme();

  // Default background uses 'transparent' to inherit parent's background
  const defaultBackground = {
    p: 3,
    bgcolor: 'transparent',
  };

  const backgroundStyle = background || defaultBackground;

  const baseSx = {
    overflow: 'auto',
    minHeight: minHeight || 'auto',
    '& .katex-display': {
      margin: '1em 0 !important',
      textAlign: 'center',
      overflowX: 'auto',
      overflowY: 'hidden'
    },
    '& .katex': {
      fontSize: '1em !important',
      lineHeight: '1.2 !important'
    },
    '& .katex-inline': {
      display: 'inline !important',
      margin: '0 !important',
      padding: '0 !important'
    },
    '& table': {
      width: '100%',
      borderCollapse: 'collapse',
      marginTop: '1em',
      marginBottom: '1em',
      overflow: 'auto',
      display: 'block',
    },
    '& thead': {
      backgroundColor: theme.palette.mode === 'dark' ? theme.palette.grey[800] : theme.palette.grey[100],
    },
    '& th': {
      padding: '12px',
      textAlign: 'left',
      fontWeight: 600,
      borderBottom: `2px solid ${theme.palette.divider}`,
      borderRight: `1px solid ${theme.palette.divider}`,
      '&:last-child': {
        borderRight: 'none',
      },
    },
    '& td': {
      padding: '12px',
      borderBottom: `1px solid ${theme.palette.divider}`,
      borderRight: `1px solid ${theme.palette.divider}`,
      '&:last-child': {
        borderRight: 'none',
      },
    },
    '& tbody tr': {
      '&:hover': {
        backgroundColor: theme.palette.mode === 'dark'
          ? theme.palette.grey[900]
          : theme.palette.grey[50],
      },
    },
    '& img': {
      maxWidth: '70%',
      height: 'auto',
      display: 'block',
      margin: '24px auto',
      borderRadius: '8px',
      boxShadow: theme.shadows[2],
    },
  };

  return (
    <Box sx={[baseSx, backgroundStyle, sx].flat()}>
      {content ? (
        <ReactMarkdown
          skipHtml={false}
          remarkPlugins={[remarkParse, remarkGfm, remarkMath, remarkRehype]}
          rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema], rehypeKatex]}
          components={{
            table: ({ ...props }) => (
              <table {...props} style={{ width: '100%', borderCollapse: 'collapse' }} />
            ),
            thead: ({ ...props }) => (
              <thead {...props} />
            ),
            tbody: ({ ...props }) => (
              <tbody {...props} />
            ),
            tr: ({ ...props }) => (
              <tr {...props} />
            ),
            th: ({ ...props }) => (
              <th {...props} />
            ),
            td: ({ ...props }) => (
              <td {...props} />
            ),
            code: ((props: { className?: string; children?: React.ReactNode; inline?: boolean }) => {
              const { className, children, inline } = props;
              const match = /language-(\w+)/.exec(className || '');
              if (!inline && match) {
                return (
                  <CodeBlock className={className}>
                    {String(children).replace(/\n$/, '')}
                  </CodeBlock>
                );
              }
              return (
                <CodeBlock className={className} inline={true}>
                  {String(children).replace(/\n$/, '')}
                </CodeBlock>
              );
            }) as React.ComponentType,
            span: ({ className, children, ...props }) => {
              if (className && className.includes('math')) {
                return <span className={className} {...props}>{children}</span>;
              }
              return <span className={className} {...props}>{children}</span>;
            },
            div: ({ className, children, ...props }) => {
              if (className && className.includes('math')) {
                return <div className={className} {...props}>{children}</div>;
              }
              return <div className={className} {...props}>{children}</div>;
            }
          }}
        >
          {content.replace(/\\\$/g, '$')}
        </ReactMarkdown>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
          {emptyMessage}
        </Typography>
      )}
    </Box>
  );
};

// Export with old name for backward compatibility
export const MarkdownPreview = MarkdownView;

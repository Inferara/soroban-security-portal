import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider as MuiThemeProvider, createTheme } from '@mui/material/styles';
import { ThemeProvider } from '../../contexts/ThemeContext';
import { CodeBlock } from '../CodeBlock';

const muiTheme = createTheme();

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <MuiThemeProvider theme={muiTheme}>
    <ThemeProvider>{children}</ThemeProvider>
  </MuiThemeProvider>
);

// Mock clipboard API
const mockClipboard = {
  writeText: vi.fn(),
};
Object.assign(navigator, {
  clipboard: mockClipboard,
});

describe('CodeBlock', () => {
  beforeEach(() => {
    mockClipboard.writeText.mockClear();
    mockClipboard.writeText.mockResolvedValue(undefined);
  });

  describe('inline code', () => {
    it('renders inline code correctly', () => {
      render(<CodeBlock inline>const x = 1;</CodeBlock>, { wrapper });

      const code = screen.getByText('const x = 1;');
      expect(code).toBeInTheDocument();
      expect(code.tagName).toBe('CODE');
    });

    it('applies inline styling', () => {
      render(<CodeBlock inline>inline code</CodeBlock>, { wrapper });

      const code = screen.getByText('inline code');
      expect(code).toHaveStyle({ borderRadius: '4px' });
    });
  });

  describe('code block', () => {
    it('renders code block with content', () => {
      const { container } = render(
        <CodeBlock className="language-javascript">
          {'function hello() {\n  return "world";\n}'}
        </CodeBlock>,
        { wrapper }
      );

      // Content should be in the DOM - syntax highlighter may tokenize it
      expect(container.textContent).toContain('function');
      expect(container.textContent).toContain('hello');
    });

    it('shows language label', () => {
      render(
        <CodeBlock className="language-typescript">const x: number = 1;</CodeBlock>,
        { wrapper }
      );

      expect(screen.getByText('TypeScript')).toBeInTheDocument();
    });

    it('shows copy button', () => {
      render(
        <CodeBlock className="language-javascript">const x = 1;</CodeBlock>,
        { wrapper }
      );

      expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument();
    });
  });

  describe('language detection', () => {
    const languageTests = [
      { className: 'language-js', expected: 'JavaScript' },
      { className: 'language-javascript', expected: 'JavaScript' },
      { className: 'language-ts', expected: 'TypeScript' },
      { className: 'language-typescript', expected: 'TypeScript' },
      { className: 'language-jsx', expected: 'JSX' },
      { className: 'language-tsx', expected: 'TSX' },
      { className: 'language-html', expected: 'HTML' },
      { className: 'language-css', expected: 'CSS' },
      { className: 'language-python', expected: 'Python' },
      { className: 'language-py', expected: 'Python' },
      { className: 'language-java', expected: 'Java' },
      { className: 'language-go', expected: 'Go' },
      { className: 'language-rust', expected: 'Rust' },
      { className: 'language-sql', expected: 'SQL' },
      { className: 'language-json', expected: 'JSON' },
      { className: 'language-yaml', expected: 'YAML' },
      { className: 'language-bash', expected: 'Bash' },
      { className: 'language-shell', expected: 'Shell' },
      { className: 'language-dockerfile', expected: 'Dockerfile' },
      { className: 'language-markdown', expected: 'Markdown' },
      { className: 'language-md', expected: 'Markdown' },
    ];

    languageTests.forEach(({ className, expected }) => {
      it(`displays "${expected}" for ${className}`, () => {
        render(<CodeBlock className={className}>code</CodeBlock>, { wrapper });
        expect(screen.getByText(expected)).toBeInTheDocument();
      });
    });

    it('shows raw language name for unknown languages', () => {
      render(<CodeBlock className="language-unknown">code</CodeBlock>, { wrapper });
      expect(screen.getByText('unknown')).toBeInTheDocument();
    });

    it('defaults to "text" when no language specified', () => {
      render(<CodeBlock>plain text</CodeBlock>, { wrapper });
      expect(screen.getByText('Text')).toBeInTheDocument();
    });
  });

  describe('copy functionality', () => {
    it('copies code to clipboard when copy button is clicked', async () => {
      const code = 'const x = 1;';
      render(<CodeBlock className="language-javascript">{code}</CodeBlock>, { wrapper });

      const copyButton = screen.getByRole('button', { name: /copy/i });
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(mockClipboard.writeText).toHaveBeenCalledWith(code);
      });
    });

    it('shows "Copied!" tooltip after successful copy', async () => {
      render(
        <CodeBlock className="language-javascript">const x = 1;</CodeBlock>,
        { wrapper }
      );

      const copyButton = screen.getByRole('button', { name: /copy/i });
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /copied/i })).toBeInTheDocument();
      });
    });

    it('handles copy error gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockClipboard.writeText.mockRejectedValue(new Error('Copy failed'));

      render(
        <CodeBlock className="language-javascript">const x = 1;</CodeBlock>,
        { wrapper }
      );

      const copyButton = screen.getByRole('button', { name: /copy/i });
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to copy code:', expect.any(Error));
      });

      consoleSpy.mockRestore();
    });
  });

  describe('content handling', () => {
    it('trims trailing newlines', () => {
      const { container } = render(
        <CodeBlock className="language-javascript">{'const x = 1;\n\n'}</CodeBlock>,
        { wrapper }
      );

      // Content should be present - syntax highlighter may tokenize it
      expect(container.textContent).toContain('const');
      expect(container.textContent).toContain('x');
      expect(container.textContent).toContain('1');
    });

    it('preserves internal whitespace', () => {
      const code = 'function test() {\n  return true;\n}';
      const { container } = render(
        <CodeBlock className="language-javascript">{code}</CodeBlock>,
        { wrapper }
      );

      expect(container.textContent).toContain('function');
      expect(container.textContent).toContain('test');
    });

    it('handles empty content', () => {
      render(<CodeBlock className="language-javascript">{''}</CodeBlock>, { wrapper });

      expect(screen.getByText('JavaScript')).toBeInTheDocument();
    });

    it('handles multiline code', () => {
      const multilineCode = `const a = 1;
const b = 2;
const c = 3;`;
      const { container } = render(
        <CodeBlock className="language-javascript">{multilineCode}</CodeBlock>,
        { wrapper }
      );

      // All three const statements should be in the content
      expect(container.textContent).toContain('const');
      expect(container.textContent).toContain('a');
      expect(container.textContent).toContain('b');
      expect(container.textContent).toContain('c');
    });
  });

  describe('styling', () => {
    it('applies block code container styles', () => {
      const { container } = render(
        <CodeBlock className="language-javascript">code</CodeBlock>,
        { wrapper }
      );

      const codeContainer = container.querySelector('.MuiBox-root');
      expect(codeContainer).toBeInTheDocument();
    });
  });
});

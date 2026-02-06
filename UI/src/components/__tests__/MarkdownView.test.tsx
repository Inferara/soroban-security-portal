import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider as MuiThemeProvider, createTheme } from '@mui/material/styles';
import { ThemeProvider } from '../../contexts/ThemeContext';
import { MarkdownView, MarkdownPreview } from '../MarkdownView';

const muiTheme = createTheme();

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <MuiThemeProvider theme={muiTheme}>
    <ThemeProvider>{children}</ThemeProvider>
  </MuiThemeProvider>
);

describe('MarkdownView', () => {
  describe('rendering', () => {
    it('renders markdown content', () => {
      render(<MarkdownView content="# Hello World" />, { wrapper });
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Hello World');
    });

    it('renders empty message when content is empty', () => {
      render(<MarkdownView content="" />, { wrapper });
      expect(screen.getByText('No content to preview')).toBeInTheDocument();
    });

    it('renders custom empty message', () => {
      render(<MarkdownView content="" emptyMessage="Nothing here" />, { wrapper });
      expect(screen.getByText('Nothing here')).toBeInTheDocument();
    });

    it('renders paragraph text', () => {
      render(<MarkdownView content="This is a paragraph." />, { wrapper });
      expect(screen.getByText('This is a paragraph.')).toBeInTheDocument();
    });

    it('renders multiple heading levels', () => {
      const content = `# H1
## H2
### H3
#### H4
##### H5
###### H6`;

      render(<MarkdownView content={content} />, { wrapper });

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('H1');
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('H2');
      expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('H3');
      expect(screen.getByRole('heading', { level: 4 })).toHaveTextContent('H4');
      expect(screen.getByRole('heading', { level: 5 })).toHaveTextContent('H5');
      expect(screen.getByRole('heading', { level: 6 })).toHaveTextContent('H6');
    });

    it('renders links', () => {
      render(<MarkdownView content="[Test Link](https://example.com)" />, { wrapper });

      const link = screen.getByRole('link', { name: 'Test Link' });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', 'https://example.com');
    });

    it('renders lists', () => {
      const content = `- Item 1
- Item 2
- Item 3`;

      render(<MarkdownView content={content} />, { wrapper });

      expect(screen.getByText('Item 1')).toBeInTheDocument();
      expect(screen.getByText('Item 2')).toBeInTheDocument();
      expect(screen.getByText('Item 3')).toBeInTheDocument();
    });

    it('renders ordered lists', () => {
      const content = `1. First
2. Second
3. Third`;

      render(<MarkdownView content={content} />, { wrapper });

      expect(screen.getByText('First')).toBeInTheDocument();
      expect(screen.getByText('Second')).toBeInTheDocument();
      expect(screen.getByText('Third')).toBeInTheDocument();
    });

    it('renders bold text', () => {
      render(<MarkdownView content="This is **bold** text" />, { wrapper });
      expect(screen.getByText('bold')).toBeInTheDocument();
    });

    it('renders italic text', () => {
      render(<MarkdownView content="This is *italic* text" />, { wrapper });
      expect(screen.getByText('italic')).toBeInTheDocument();
    });

    it('renders inline code', () => {
      render(<MarkdownView content="This is `inline code` here" />, { wrapper });
      expect(screen.getByText('inline code')).toBeInTheDocument();
    });

    it('renders blockquotes', () => {
      render(<MarkdownView content="> This is a quote" />, { wrapper });
      expect(screen.getByText('This is a quote')).toBeInTheDocument();
    });

    it('renders tables (GFM)', () => {
      const content = `| Header 1 | Header 2 |
| -------- | -------- |
| Cell 1   | Cell 2   |`;

      render(<MarkdownView content={content} />, { wrapper });

      expect(screen.getByText('Header 1')).toBeInTheDocument();
      expect(screen.getByText('Header 2')).toBeInTheDocument();
      expect(screen.getByText('Cell 1')).toBeInTheDocument();
      expect(screen.getByText('Cell 2')).toBeInTheDocument();
    });
  });

  describe('XSS security (sanitization)', () => {
    it('strips script tags', () => {
      const maliciousContent = '<script>alert("XSS")</script>Hello';
      render(<MarkdownView content={maliciousContent} />, { wrapper });

      // Script should be stripped, text should remain
      expect(screen.getByText('Hello')).toBeInTheDocument();
      expect(document.querySelector('script')).not.toBeInTheDocument();
    });

    it('strips onclick handlers', () => {
      const maliciousContent = '<div onclick="alert(\'XSS\')">Click me</div>';
      render(<MarkdownView content={maliciousContent} />, { wrapper });

      const div = screen.getByText('Click me');
      expect(div).not.toHaveAttribute('onclick');
    });

    it('strips onerror handlers on images', () => {
      const maliciousContent = '<img src="x" onerror="alert(\'XSS\')" alt="test" />';
      render(<MarkdownView content={maliciousContent} />, { wrapper });

      const img = document.querySelector('img');
      expect(img).not.toHaveAttribute('onerror');
    });

    it('strips onload handlers', () => {
      const maliciousContent = '<img src="test.png" onload="alert(\'XSS\')" alt="test" />';
      render(<MarkdownView content={maliciousContent} />, { wrapper });

      const img = document.querySelector('img');
      expect(img).not.toHaveAttribute('onload');
    });

    it('strips iframe tags', () => {
      const maliciousContent = '<iframe src="https://evil.com"></iframe>Safe content';
      render(<MarkdownView content={maliciousContent} />, { wrapper });

      expect(screen.getByText('Safe content')).toBeInTheDocument();
      expect(document.querySelector('iframe')).not.toBeInTheDocument();
    });

    it('strips inline style tags from content', () => {
      const maliciousContent = '<style>body { display: none; }</style>Content';
      render(<MarkdownView content={maliciousContent} />, { wrapper });

      expect(screen.getByText('Content')).toBeInTheDocument();
      // Note: MUI uses emotion CSS which adds style tags, so we check that
      // the malicious style content is not present instead
      const styles = document.querySelectorAll('style');
      let foundMaliciousStyle = false;
      styles.forEach(style => {
        if (style.textContent?.includes('display: none')) {
          foundMaliciousStyle = true;
        }
      });
      expect(foundMaliciousStyle).toBe(false);
    });

    it('strips object tags', () => {
      const maliciousContent = '<object data="malware.swf"></object>Safe';
      render(<MarkdownView content={maliciousContent} />, { wrapper });

      expect(screen.getByText('Safe')).toBeInTheDocument();
      expect(document.querySelector('object')).not.toBeInTheDocument();
    });

    it('strips embed tags', () => {
      const maliciousContent = '<embed src="malware.swf" />Safe';
      render(<MarkdownView content={maliciousContent} />, { wrapper });

      expect(screen.getByText('Safe')).toBeInTheDocument();
      expect(document.querySelector('embed')).not.toBeInTheDocument();
    });

    it('strips form tags', () => {
      const maliciousContent = '<form action="https://evil.com/steal"><input name="password" /></form>Safe';
      render(<MarkdownView content={maliciousContent} />, { wrapper });

      expect(screen.getByText('Safe')).toBeInTheDocument();
      expect(document.querySelector('form')).not.toBeInTheDocument();
      expect(document.querySelector('input')).not.toBeInTheDocument();
    });

    it('blocks javascript: protocol in links', () => {
      // rehype-sanitize blocks javascript: protocol by default
      const maliciousContent = '<a href="javascript:alert(\'XSS\')">Click</a>';
      render(<MarkdownView content={maliciousContent} />, { wrapper });

      const link = screen.getByText('Click');
      // The href should be removed or sanitized
      expect(link).not.toHaveAttribute('href', expect.stringContaining('javascript:'));
    });

    it('blocks data:text/html in links', () => {
      const maliciousContent = '<a href="data:text/html,<script>alert(\'XSS\')</script>">Click</a>';
      render(<MarkdownView content={maliciousContent} />, { wrapper });

      const link = screen.getByText('Click');
      // data:text/html should be blocked (only data: allowed for images)
      expect(link).not.toHaveAttribute('href', expect.stringContaining('data:'));
    });

    it('allows safe https links', () => {
      const content = '[Safe Link](https://example.com)';
      render(<MarkdownView content={content} />, { wrapper });

      const link = screen.getByRole('link', { name: 'Safe Link' });
      expect(link).toHaveAttribute('href', 'https://example.com');
    });

    it('allows mailto links', () => {
      const content = '[Email](mailto:test@example.com)';
      render(<MarkdownView content={content} />, { wrapper });

      const link = screen.getByRole('link', { name: 'Email' });
      expect(link).toHaveAttribute('href', 'mailto:test@example.com');
    });

    it('allows safe image sources', () => {
      const content = '<img src="https://example.com/image.png" alt="Safe Image" />';
      render(<MarkdownView content={content} />, { wrapper });

      const img = screen.getByRole('img', { name: 'Safe Image' });
      expect(img).toHaveAttribute('src', 'https://example.com/image.png');
    });

    it('strips SVG with embedded script', () => {
      const maliciousContent = `<svg onload="alert('XSS')"><script>alert('XSS')</script></svg>Safe`;
      render(<MarkdownView content={maliciousContent} />, { wrapper });

      expect(screen.getByText('Safe')).toBeInTheDocument();
      // Script inside SVG should be removed
      expect(document.querySelector('script')).not.toBeInTheDocument();
    });
  });

  describe('styling', () => {
    it('applies custom sx props', () => {
      const { container } = render(
        <MarkdownView content="Test" sx={{ padding: '20px' }} />,
        { wrapper }
      );

      const box = container.querySelector('.MuiBox-root');
      expect(box).toBeInTheDocument();
    });

    it('applies custom minHeight', () => {
      const { container } = render(
        <MarkdownView content="Test" minHeight="200px" />,
        { wrapper }
      );

      const box = container.querySelector('.MuiBox-root');
      expect(box).toBeInTheDocument();
    });
  });

  describe('backward compatibility', () => {
    it('exports MarkdownPreview as alias', () => {
      expect(MarkdownPreview).toBe(MarkdownView);
    });

    it('MarkdownPreview renders correctly', () => {
      render(<MarkdownPreview content="# Test" />, { wrapper });
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Test');
    });
  });

  describe('edge cases', () => {
    it('handles null-like content gracefully', () => {
      // Empty string shows empty message
      render(<MarkdownView content="" />, { wrapper });
      expect(screen.getByText('No content to preview')).toBeInTheDocument();
    });

    it('handles very long content', () => {
      const longContent = '# Title\n\n' + 'This is a paragraph. '.repeat(1000);
      render(<MarkdownView content={longContent} />, { wrapper });

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Title');
    });

    it('handles escaped dollar signs', () => {
      const content = 'The price is \\$100';
      render(<MarkdownView content={content} />, { wrapper });

      // The \$ should be converted to $
      expect(screen.getByText(/The price is \$100/)).toBeInTheDocument();
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ShareButtons } from '../ShareButtons';

describe('ShareButtons', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('opens an X share intent with the title and url', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(<ShareButtons title="Bug A" url="https://x/vulnerability/1" />);
    fireEvent.click(screen.getByLabelText('share on x'));
    expect(open).toHaveBeenCalledWith(
      expect.stringContaining('twitter.com/intent/tweet'),
      '_blank',
      'noopener,noreferrer',
    );
    expect(open.mock.calls[0][0]).toContain(encodeURIComponent('https://x/vulnerability/1'));
  });

  it('opens a LinkedIn share intent with the url', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(<ShareButtons title="Bug A" url="https://x/report/2" />);
    fireEvent.click(screen.getByLabelText('share on linkedin'));
    expect(open.mock.calls[0][0]).toContain('linkedin.com/sharing/share-offsite');
    expect(open.mock.calls[0][0]).toContain(encodeURIComponent('https://x/report/2'));
  });

  it('shows success snackbar after copying', async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    render(<ShareButtons title="Bug A" url="https://x/vulnerability/1" />);
    fireEvent.click(screen.getByLabelText('copy link'));
    expect(await screen.findByText('Link copied to clipboard!')).toBeInTheDocument();
  });

  it('shows error snackbar when clipboard write fails', async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
    render(<ShareButtons title="Bug A" url="https://x/vulnerability/1" />);
    fireEvent.click(screen.getByLabelText('copy link'));
    expect(await screen.findByText('Failed to copy link')).toBeInTheDocument();
  });
});

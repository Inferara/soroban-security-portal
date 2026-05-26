import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../../__tests__/test-utils';
import { CommentEditor } from '../CommentEditor';

vi.mock('../../../components/MarkdownEditor', () => ({
  MarkdownEditor: ({ value, onChange, label }: { value: string; onChange: (v: string) => void; label?: string }) => (
    <textarea aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

describe('CommentEditor', () => {
  it('submit is disabled when empty', () => {
    render(<CommentEditor onSubmit={vi.fn()} />);
    expect(screen.getByRole('button', { name: /comment/i })).toBeDisabled();
  });

  it('submit is enabled when content is entered', () => {
    render(<CommentEditor onSubmit={vi.fn()} />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'hello' } });
    expect(screen.getByRole('button', { name: /comment/i })).not.toBeDisabled();
  });

  it('calls onSubmit with content and clears on success', async () => {
    const onSubmit = vi.fn().mockResolvedValue(true);
    render(<CommentEditor onSubmit={onSubmit} />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'my comment' } });
    fireEvent.click(screen.getByRole('button', { name: /comment/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('my comment'));
  });

  it('renders Cancel button when onCancel is provided', () => {
    render(<CommentEditor onSubmit={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('calls onCancel when Cancel is clicked', () => {
    const onCancel = vi.fn();
    render(<CommentEditor onSubmit={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('uses custom submitLabel', () => {
    render(<CommentEditor onSubmit={vi.fn()} submitLabel="Reply" />);
    expect(screen.getByRole('button', { name: /reply/i })).toBeInTheDocument();
  });
});

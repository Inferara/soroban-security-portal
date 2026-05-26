import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '../../../__tests__/test-utils';
import { CommentItem } from '../CommentItem';
import { Comment, CommentEntityType } from '../../../api/soroban-security-portal/models/comment';

vi.mock('../../../components/MarkdownEditor', () => ({
  MarkdownEditor: ({ value, onChange, label }: { value: string; onChange: (v: string) => void; label?: string }) => (
    <textarea aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

const RECENT = new Date(Date.now() - 5 * 60 * 1000).toISOString(); // 5 min ago
const OLD = new Date(Date.now() - 60 * 60 * 1000).toISOString();   // 1 hr ago

const make = (over: Partial<Comment> = {}): Comment => ({
  id: 1, entityType: CommentEntityType.Report, entityId: 9, parentCommentId: null,
  content: 'hello world', contentHtml: '<p>hello world</p>', authorId: 5, authorName: 'Alice',
  upvoteCount: 0, downvoteCount: 0, isEdited: false, createdAt: '2026-01-01T00:00:00Z',
  updatedAt: null, replyCount: 0, replies: [], currentUserVote: null, isOwn: false, ...over,
});

const defaultProps = {
  canReply: false,
  onReply: vi.fn(),
  onVote: vi.fn(),
  canVote: false,
  onEdit: vi.fn().mockResolvedValue(true),
  onDelete: vi.fn(),
  isAdmin: false,
};

describe('CommentItem', () => {
  it('renders author and body', () => {
    render(<CommentItem comment={make()} {...defaultProps} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('hello world')).toBeInTheDocument();
  });

  it('shows "edited" when isEdited', () => {
    render(<CommentItem comment={make({ isEdited: true })} {...defaultProps} />);
    expect(screen.getByText(/edited/)).toBeInTheDocument();
  });

  it('renders nested replies', () => {
    render(
      <CommentItem
        comment={make({ replies: [make({ id: 2, content: 'a reply', authorName: 'Bob' })], replyCount: 1 })}
        {...defaultProps}
      />
    );
    expect(screen.getByText('a reply')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('shows Reply button only when canReply and not a reply', () => {
    render(<CommentItem comment={make()} {...defaultProps} canReply onReply={vi.fn()} />);
    expect(screen.getByRole('button', { name: /reply/i })).toBeInTheDocument();
  });

  it('does not show Reply button when canReply is false', () => {
    render(<CommentItem comment={make()} {...defaultProps} canReply={false} />);
    expect(screen.queryByRole('button', { name: /reply/i })).not.toBeInTheDocument();
  });

  it('does not show Reply button when isReply is true', () => {
    render(<CommentItem comment={make()} {...defaultProps} canReply isReply onReply={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /reply/i })).not.toBeInTheDocument();
  });

  it('reveals inline CommentEditor when Reply is clicked', () => {
    render(<CommentItem comment={make()} {...defaultProps} canReply onReply={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /reply/i }));
    // The inline editor (mocked as textarea with aria-label="Comment") should appear
    expect(screen.getByRole('textbox', { name: /comment/i })).toBeInTheDocument();
  });

  it('hides inline editor after clicking the editor Cancel', () => {
    render(<CommentItem comment={make()} {...defaultProps} canReply onReply={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /reply/i }));
    // Two "Cancel" buttons are now present: [0] the Reply toggle (relabeled "Cancel"
    // while open) and [1] the CommentEditor's own Cancel. Exercise the editor's Cancel.
    const cancelButtons = screen.getAllByRole('button', { name: /cancel/i });
    expect(cancelButtons).toHaveLength(2);
    fireEvent.click(cancelButtons[1]);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  // --- Owner delete ---

  it('shows Delete button when isOwn is true', () => {
    render(<CommentItem comment={make({ isOwn: true })} {...defaultProps} />);
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
  });

  it('shows Delete button when isAdmin is true (even if not own)', () => {
    render(<CommentItem comment={make({ isOwn: false })} {...defaultProps} isAdmin />);
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
  });

  it('does not show Delete button for a non-owner non-admin', () => {
    render(<CommentItem comment={make({ isOwn: false })} {...defaultProps} isAdmin={false} />);
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
  });

  it('calls onDelete when Delete clicked and confirmed', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const onDelete = vi.fn();
    render(<CommentItem comment={make({ id: 42, isOwn: true })} {...defaultProps} onDelete={onDelete} />);
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    expect(onDelete).toHaveBeenCalledWith(42);
  });

  it('does not call onDelete when Delete clicked but dismissed', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const onDelete = vi.fn();
    render(<CommentItem comment={make({ isOwn: true })} {...defaultProps} onDelete={onDelete} />);
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    expect(onDelete).not.toHaveBeenCalled();
  });

  // --- Owner edit ---

  it('shows Edit button when isOwn and createdAt is recent', () => {
    render(<CommentItem comment={make({ isOwn: true, createdAt: RECENT })} {...defaultProps} />);
    expect(screen.getByRole('button', { name: /^edit$/i })).toBeInTheDocument();
  });

  it('does not show Edit button when createdAt is older than 30 min', () => {
    render(<CommentItem comment={make({ isOwn: true, createdAt: OLD })} {...defaultProps} />);
    expect(screen.queryByRole('button', { name: /^edit$/i })).not.toBeInTheDocument();
  });

  it('does not show Edit button for non-owner even if recent', () => {
    render(<CommentItem comment={make({ isOwn: false, createdAt: RECENT })} {...defaultProps} />);
    expect(screen.queryByRole('button', { name: /^edit$/i })).not.toBeInTheDocument();
  });

  it('clicking Edit opens inline editor pre-filled with comment content', () => {
    render(
      <CommentItem
        comment={make({ isOwn: true, createdAt: RECENT, content: 'original text' })}
        {...defaultProps}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /^edit$/i }));
    // The editor textarea should be pre-filled
    const textarea = screen.getByRole('textbox', { name: /comment/i }) as HTMLTextAreaElement;
    expect(textarea.value).toBe('original text');
  });

  it('closing edit via Cancel restores view mode', () => {
    render(
      <CommentItem
        comment={make({ isOwn: true, createdAt: RECENT })}
        {...defaultProps}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /^edit$/i }));
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('submitting edit calls onEdit with id and content and closes editor', async () => {
    const onEdit = vi.fn().mockResolvedValue(true);
    render(
      <CommentItem
        comment={make({ id: 7, isOwn: true, createdAt: RECENT, content: 'original' })}
        {...defaultProps}
        onEdit={onEdit}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /^edit$/i }));
    const textarea = screen.getByRole('textbox', { name: /comment/i });
    fireEvent.change(textarea, { target: { value: 'updated content' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    // Wait for async resolution
    await vi.waitFor(() => expect(onEdit).toHaveBeenCalledWith(7, 'updated content'));
  });

  // --- canVote + isOwn guard ---

  it('vote buttons are disabled when canVote=true but isOwn=true', () => {
    render(
      <CommentItem
        comment={make({ isOwn: true })}
        {...defaultProps}
        canVote
      />
    );
    expect(screen.getByLabelText('upvote')).toBeDisabled();
    expect(screen.getByLabelText('downvote')).toBeDisabled();
  });

  it('vote buttons are enabled when canVote=true and isOwn=false', () => {
    render(
      <CommentItem
        comment={make({ isOwn: false })}
        {...defaultProps}
        canVote
      />
    );
    expect(screen.getByLabelText('upvote')).not.toBeDisabled();
    expect(screen.getByLabelText('downvote')).not.toBeDisabled();
  });
});

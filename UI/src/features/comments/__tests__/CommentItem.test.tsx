import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '../../../__tests__/test-utils';
import { CommentItem } from '../CommentItem';
import { Comment, CommentEntityType } from '../../../api/soroban-security-portal/models/comment';

vi.mock('../../../components/MarkdownEditor', () => ({
  MarkdownEditor: ({ value, onChange, label }: { value: string; onChange: (v: string) => void; label?: string }) => (
    <textarea aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

const make = (over: Partial<Comment> = {}): Comment => ({
  id: 1, entityType: CommentEntityType.Report, entityId: 9, parentCommentId: null,
  content: 'hello world', contentHtml: '<p>hello world</p>', authorId: 5, authorName: 'Alice',
  upvoteCount: 0, downvoteCount: 0, isEdited: false, createdAt: '2026-01-01T00:00:00Z',
  updatedAt: null, replyCount: 0, replies: [], currentUserVote: null, isOwn: false, ...over,
});

describe('CommentItem', () => {
  it('renders author and body', () => {
    render(<CommentItem comment={make()} canReply={false} onReply={vi.fn()} onVote={vi.fn()} canVote={false} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('hello world')).toBeInTheDocument();
  });

  it('shows "edited" when isEdited', () => {
    render(<CommentItem comment={make({ isEdited: true })} canReply={false} onReply={vi.fn()} onVote={vi.fn()} canVote={false} />);
    expect(screen.getByText(/edited/)).toBeInTheDocument();
  });

  it('renders nested replies', () => {
    render(
      <CommentItem
        comment={make({ replies: [make({ id: 2, content: 'a reply', authorName: 'Bob' })], replyCount: 1 })}
        canReply={false}
        onReply={vi.fn()}
        onVote={vi.fn()}
        canVote={false}
      />
    );
    expect(screen.getByText('a reply')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('shows Reply button only when canReply and not a reply', () => {
    render(<CommentItem comment={make()} canReply onReply={vi.fn()} onVote={vi.fn()} canVote={false} />);
    expect(screen.getByRole('button', { name: /reply/i })).toBeInTheDocument();
  });

  it('does not show Reply button when canReply is false', () => {
    render(<CommentItem comment={make()} canReply={false} onReply={vi.fn()} onVote={vi.fn()} canVote={false} />);
    expect(screen.queryByRole('button', { name: /reply/i })).not.toBeInTheDocument();
  });

  it('does not show Reply button when isReply is true', () => {
    render(<CommentItem comment={make()} canReply isReply onReply={vi.fn()} onVote={vi.fn()} canVote={false} />);
    expect(screen.queryByRole('button', { name: /reply/i })).not.toBeInTheDocument();
  });

  it('reveals inline CommentEditor when Reply is clicked', () => {
    render(<CommentItem comment={make()} canReply onReply={vi.fn()} onVote={vi.fn()} canVote={false} />);
    fireEvent.click(screen.getByRole('button', { name: /reply/i }));
    // The inline editor (mocked as textarea with aria-label="Comment") should appear
    expect(screen.getByRole('textbox', { name: /comment/i })).toBeInTheDocument();
  });

  it('hides inline editor after clicking the editor Cancel', () => {
    render(<CommentItem comment={make()} canReply onReply={vi.fn()} onVote={vi.fn()} canVote={false} />);
    fireEvent.click(screen.getByRole('button', { name: /reply/i }));
    // Two "Cancel" buttons are now present: [0] the Reply toggle (relabeled "Cancel"
    // while open) and [1] the CommentEditor's own Cancel. Exercise the editor's Cancel.
    const cancelButtons = screen.getAllByRole('button', { name: /cancel/i });
    expect(cancelButtons).toHaveLength(2);
    fireEvent.click(cancelButtons[1]);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});

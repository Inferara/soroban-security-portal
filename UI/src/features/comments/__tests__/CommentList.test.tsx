import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '../../../__tests__/test-utils';
import { CommentList } from '../CommentList';
import { CommentEntityType } from '../../../api/soroban-security-portal/models/comment';

vi.mock('../../../components/MarkdownEditor', () => ({
  MarkdownEditor: ({ value, onChange, label }: { value: string; onChange: (v: string) => void; label?: string }) => (
    <textarea aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

vi.mock('../../../api/soroban-security-portal/soroban-security-portal-api', () => ({
  getCommentsCall: vi.fn().mockResolvedValue([]),
  getCommentCountCall: vi.fn().mockResolvedValue(0),
  addCommentCall: vi.fn(),
  deleteCommentCall: vi.fn(),
  voteCommentCall: vi.fn().mockResolvedValue({ upvoteCount: 0, downvoteCount: 0, currentUserVote: null }),
  editCommentCall: vi.fn(),
}));

describe('CommentList', () => {
  it('shows empty state when there are no comments', async () => {
    render(<CommentList entityType={CommentEntityType.Report} entityId={9} />);
    await waitFor(() => expect(screen.getByText(/No comments yet/i)).toBeInTheDocument());
  });

  it('shows the login CTA when unauthenticated', async () => {
    render(<CommentList entityType={CommentEntityType.Report} entityId={9} />);
    await waitFor(() => expect(screen.getByRole('button', { name: /log in to comment/i })).toBeInTheDocument());
  });
});

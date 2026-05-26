import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '../../../__tests__/test-utils';
import { CommentVoteButtons } from '../CommentVoteButtons';

describe('CommentVoteButtons', () => {
  it('shows the net score', () => {
    render(<CommentVoteButtons upvoteCount={5} downvoteCount={2} currentUserVote={null} canVote onVote={vi.fn()} />);
    expect(screen.getByLabelText('score')).toHaveTextContent('3');
  });

  it('upvote click sends "upvote" when not voted', () => {
    const onVote = vi.fn();
    render(<CommentVoteButtons upvoteCount={0} downvoteCount={0} currentUserVote={null} canVote onVote={onVote} />);
    fireEvent.click(screen.getByLabelText('upvote'));
    expect(onVote).toHaveBeenCalledWith('upvote');
  });

  it('upvote click sends "none" when already upvoted (toggle off)', () => {
    const onVote = vi.fn();
    render(<CommentVoteButtons upvoteCount={1} downvoteCount={0} currentUserVote="upvote" canVote onVote={onVote} />);
    fireEvent.click(screen.getByLabelText('upvote'));
    expect(onVote).toHaveBeenCalledWith('none');
  });

  it('disables buttons when canVote is false', () => {
    render(<CommentVoteButtons upvoteCount={0} downvoteCount={0} currentUserVote={null} canVote={false} onVote={vi.fn()} />);
    expect(screen.getByLabelText('upvote')).toBeDisabled();
    expect(screen.getByLabelText('downvote')).toBeDisabled();
  });

  it('downvote click sends "none" when already downvoted (toggle off)', () => {
    const onVote = vi.fn();
    render(<CommentVoteButtons upvoteCount={0} downvoteCount={1} currentUserVote="downvote" canVote onVote={onVote} />);
    fireEvent.click(screen.getByLabelText('downvote'));
    expect(onVote).toHaveBeenCalledWith('none');
  });
});

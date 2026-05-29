import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RatingSummaryCard } from '../RatingSummaryCard';
import { RatingDialog } from '../RatingDialog';
import { ReviewList } from '../ReviewList';
import { RatingEntityType, RatingSummary, PublicRating } from '../../../api/soroban-security-portal/models/rating';

const summary = (over: Partial<RatingSummary> = {}): RatingSummary => ({
  entityType: RatingEntityType.Protocol,
  entityId: 1,
  averageScore: 4.3,
  weightedAverageScore: 4.6,
  totalReviews: 10,
  distribution: { '1': 0, '2': 1, '3': 1, '4': 3, '5': 5 },
  ...over,
});

describe('RatingSummaryCard', () => {
  it('shows the average, total and weighted average', () => {
    render(<RatingSummaryCard summary={summary()} />);
    expect(screen.getByText('4.3')).toBeInTheDocument();
    expect(screen.getByText('10 ratings')).toBeInTheDocument();
    expect(screen.getByText('Weighted 4.6')).toBeInTheDocument();
  });

  it('renders an inviting empty state when there are no ratings', () => {
    render(<RatingSummaryCard summary={summary({ totalReviews: 0, averageScore: 0, distribution: {} })} />);
    expect(screen.getByText('No ratings yet')).toBeInTheDocument();
    expect(screen.getByText(/Be the first to share/i)).toBeInTheDocument();
  });
});

describe('RatingDialog', () => {
  const noop = () => {};

  it('disables Submit until a score is chosen', () => {
    render(
      <RatingDialog open entityLabel="protocol" existing={null} submitting={false} error={null}
        onClose={noop} onSubmit={noop} onDelete={noop} />,
    );
    expect(screen.getByText('Rate this protocol')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled();
  });

  it('prefills from an existing rating and enables Update + Delete', () => {
    render(
      <RatingDialog open entityLabel="protocol" existing={{ id: 7, score: 4, review: 'Solid audits', createdAt: '' }}
        submitting={false} error={null} onClose={noop} onSubmit={noop} onDelete={noop} />,
    );
    expect(screen.getByText('Update your rating')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Solid audits')).toBeInTheDocument();
    expect(screen.getByText('12/2000')).toBeInTheDocument(); // 'Solid audits'.length === 12
    expect(screen.getByRole('button', { name: 'Update' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('enforces the 2000 character cap on the review', () => {
    render(
      <RatingDialog open entityLabel="protocol" existing={{ id: 1, score: 5, review: '', createdAt: '' }}
        submitting={false} error={null} onClose={noop} onSubmit={noop} onDelete={noop} />,
    );
    const textarea = screen.getByLabelText(/Add a review/i);
    fireEvent.change(textarea, { target: { value: 'x'.repeat(2500) } });
    expect(screen.getByText('2000/2000')).toBeInTheDocument();
  });

  it('submits the chosen score and review', () => {
    const onSubmit = vi.fn();
    render(
      <RatingDialog open entityLabel="protocol" existing={{ id: 1, score: 5, review: 'Great', createdAt: '' }}
        submitting={false} error={null} onClose={noop} onSubmit={onSubmit} onDelete={noop} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));
    expect(onSubmit).toHaveBeenCalledWith(5, 'Great');
  });
});

describe('ReviewList', () => {
  const review = (over: Partial<PublicRating> = {}): PublicRating => ({
    id: 1, entityType: RatingEntityType.Protocol, entityId: 1,
    score: 5, review: 'Very responsive team', createdAt: '2026-01-15',
    authorId: 42, authorName: 'Alice', ...over,
  });

  it('renders the author name and review text', () => {
    render(<ReviewList reviews={[review()]} total={1} loadingMore={false} onLoadMore={() => {}} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Very responsive team')).toBeInTheDocument();
  });

  it('renders user-supplied markup as inert text (no injection)', () => {
    const payload = '<img src=x onerror="alert(1)">';
    render(<ReviewList reviews={[review({ review: payload })]} total={1} loadingMore={false} onLoadMore={() => {}} />);
    // The literal string is shown as text; no <img> element is created from it.
    expect(screen.getByText(payload)).toBeInTheDocument();
    expect(document.querySelector('img[onerror]')).toBeNull();
  });

  it('shows a Load more button when more reviews remain', () => {
    const onLoadMore = vi.fn();
    render(<ReviewList reviews={[review()]} total={5} loadingMore={false} onLoadMore={onLoadMore} />);
    const btn = screen.getByRole('button', { name: /Load more/i });
    fireEvent.click(btn);
    expect(onLoadMore).toHaveBeenCalled();
  });

  it('renders an empty state when there are no reviews', () => {
    render(<ReviewList reviews={[]} total={0} loadingMore={false} onLoadMore={() => {}} />);
    expect(screen.getByText('No written reviews yet.')).toBeInTheDocument();
  });

  it('hides the report flag by default and shows it when canFlag is set', () => {
    const { rerender } = render(<ReviewList reviews={[review()]} total={1} loadingMore={false} onLoadMore={() => {}} />);
    expect(screen.queryAllByLabelText('Report content')).toHaveLength(0);

    rerender(<ReviewList reviews={[review()]} total={1} loadingMore={false} onLoadMore={() => {}} canFlag />);
    expect(screen.queryAllByLabelText('Report content').length).toBeGreaterThan(0);
  });
});

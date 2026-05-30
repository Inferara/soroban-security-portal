import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StarRating, RatingSummary, RatingDialog } from '../index';
import { RatingEntityType, RatingSummary as RatingSummaryModel } from '../../../../api/soroban-security-portal/models/rating';

describe('social/ratings barrel exports', () => {
  it('StarRating renders without crashing', () => {
    render(<StarRating value={3} readOnly />);
    // MUI Rating renders radio inputs for each star
    expect(document.querySelector('.MuiRating-root')).toBeInTheDocument();
  });

  it('RatingSummary renders average score', () => {
    const summary: RatingSummaryModel = {
      entityType: RatingEntityType.Protocol,
      entityId: 1,
      averageScore: 4.2,
      weightedAverageScore: 4.5,
      totalReviews: 7,
      distribution: { '1': 0, '2': 0, '3': 1, '4': 3, '5': 3 },
    };
    render(<RatingSummary summary={summary} />);
    expect(screen.getByText('4.2')).toBeInTheDocument();
    expect(screen.getByText('7 ratings')).toBeInTheDocument();
  });

  it('RatingDialog renders with correct title', () => {
    const noop = () => {};
    render(
      <RatingDialog
        open
        entityLabel="auditor"
        existing={null}
        submitting={false}
        error={null}
        onClose={noop}
        onSubmit={noop}
        onDelete={noop}
      />,
    );
    expect(screen.getByText('Rate this auditor')).toBeInTheDocument();
  });
});

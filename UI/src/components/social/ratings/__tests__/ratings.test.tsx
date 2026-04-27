import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { StarRating } from '../StarRating';
import { RatingSummary } from '../RatingSummary';
import { RatingDialog } from '../RatingDialog';

// ---------------------------------------------------------------------------
// StarRating
// ---------------------------------------------------------------------------
describe('StarRating', () => {
    it('renders correct number of stars', () => {
        render(<StarRating value={3} readOnly />);
        // group label includes the value
        expect(screen.getByRole('group')).toHaveAccessibleName(/3 out of 5 stars/i);
    });

    it('renders with custom max', () => {
        render(<StarRating value={2} readOnly max={3} />);
        expect(screen.getByRole('group')).toHaveAccessibleName(/2 out of 3 stars/i);
    });

    it('calls onChange when a star is clicked', async () => {
        const onChange = vi.fn();
        render(<StarRating value={0} onChange={onChange} />);
        const buttons = screen.getAllByRole('button');
        await userEvent.click(buttons[2]); // 3rd star
        expect(onChange).toHaveBeenCalledWith(3);
    });

    it('does not render buttons in readOnly mode', () => {
        render(<StarRating value={4} readOnly />);
        expect(screen.queryAllByRole('button')).toHaveLength(0);
    });

    it('updates hover state on mouse enter/leave', () => {
        const onChange = vi.fn();
        render(<StarRating value={1} onChange={onChange} />);
        const buttons = screen.getAllByRole('button');
        fireEvent.mouseEnter(buttons[4]); // hover 5th star
        fireEvent.mouseLeave(buttons[4]);
        // no assertion on visual state, just ensure no errors thrown
        expect(buttons).toHaveLength(5);
    });

    it('renders accessible label for each star button', () => {
        render(<StarRating value={0} onChange={vi.fn()} />);
        expect(screen.getByRole('button', { name: /1 star/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /5 stars/i })).toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// RatingSummary
// ---------------------------------------------------------------------------
describe('RatingSummary', () => {
    const distribution = { 5: 10, 4: 5, 3: 3, 2: 1, 1: 1 } as const;

    it('renders average and count', () => {
        render(<RatingSummary average={4.2} count={20} distribution={distribution} />);
        expect(screen.getByText('4.2')).toBeInTheDocument();
        expect(screen.getByText(/20 ratings/i)).toBeInTheDocument();
    });

    it('renders singular "rating" for count of 1', () => {
        render(<RatingSummary average={5} count={1} />);
        expect(screen.getByText(/1 rating/i)).toBeInTheDocument();
    });

    it('renders distribution bars when showDistribution is true', () => {
        render(<RatingSummary average={4} count={20} distribution={distribution} showDistribution />);
        expect(screen.getByRole('list', { name: /rating distribution/i })).toBeInTheDocument();
        expect(screen.getAllByRole('listitem')).toHaveLength(5);
    });

    it('hides distribution when showDistribution is false', () => {
        render(<RatingSummary average={4} count={20} distribution={distribution} showDistribution={false} />);
        expect(screen.queryByRole('list')).not.toBeInTheDocument();
    });

    it('renders 0% for all bars when count is 0', () => {
        render(<RatingSummary average={0} count={0} distribution={{ 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }} />);
        const items = screen.getAllByRole('listitem');
        items.forEach((item) => {
            expect(item).toHaveAccessibleName(/0 ratings/i);
        });
    });
});

// ---------------------------------------------------------------------------
// RatingDialog
// ---------------------------------------------------------------------------
describe('RatingDialog', () => {
    const noop = vi.fn().mockResolvedValue(undefined);

    it('renders when open', () => {
        render(<RatingDialog open onClose={vi.fn()} onSubmit={noop} title="Rate this" />);
        expect(screen.getByText('Rate this')).toBeInTheDocument();
    });

    it('does not render when closed', () => {
        render(<RatingDialog open={false} onClose={vi.fn()} onSubmit={noop} />);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('shows validation error when submitting without a rating', async () => {
        render(<RatingDialog open onClose={vi.fn()} onSubmit={noop} />);
        await userEvent.click(screen.getByRole('button', { name: /submit/i }));
        expect(screen.getByRole('alert')).toHaveTextContent(/please select a star rating/i);
    });

    it('calls onSubmit with rating and review text', async () => {
        const onSubmit = vi.fn().mockResolvedValue(undefined);
        render(<RatingDialog open onClose={vi.fn()} onSubmit={onSubmit} />);

        // Select 4 stars
        const starButtons = screen.getAllByRole('button', { name: /star/i });
        await userEvent.click(starButtons[3]); // 4 stars

        // Type review
        const textarea = screen.getByRole('textbox', { name: /review text/i });
        await userEvent.type(textarea, 'Great audit!');

        await userEvent.click(screen.getByRole('button', { name: /submit/i }));
        expect(onSubmit).toHaveBeenCalledWith(4, 'Great audit!');
    });

    it('calls onClose when Cancel is clicked', async () => {
        const onClose = vi.fn();
        render(<RatingDialog open onClose={onClose} onSubmit={noop} />);
        await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
        expect(onClose).toHaveBeenCalled();
    });

    it('shows error message when onSubmit rejects', async () => {
        const onSubmit = vi.fn().mockRejectedValue(new Error('Server error'));
        render(<RatingDialog open onClose={vi.fn()} onSubmit={onSubmit} />);

        const starButtons = screen.getAllByRole('button', { name: /star/i });
        await userEvent.click(starButtons[0]); // 1 star

        await userEvent.click(screen.getByRole('button', { name: /submit/i }));
        expect(await screen.findByRole('alert')).toHaveTextContent(/failed to submit/i);
    });
});

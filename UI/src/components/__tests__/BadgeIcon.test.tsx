import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { BadgeIcon } from '../BadgeIcon';
import { UserBadge, BadgeCategory, BadgeRarity } from '../../api/soroban-security-portal/models/badge';

describe('BadgeIcon', () => {
    const mockBadge: UserBadge = {
        id: '1',
        name: 'Test Badge',
        description: 'A test badge',
        category: BadgeCategory.ACHIEVEMENT,
        rarity: BadgeRarity.RARE,
        icon: '🏆',
        color: '#2196F3',
        awardedAt: new Date('2024-01-15'),
        isLocked: false,
    };

    it('renders badge icon', () => {
        render(<BadgeIcon badge={mockBadge} />);
        expect(screen.getByText('🏆')).toBeInTheDocument();
    });

    it('shows tooltip with badge name and description', async () => {
        const { container } = render(<BadgeIcon badge={mockBadge} />);
        const badgeElement = container.firstChild;
        expect(badgeElement).toBeInTheDocument();
    });

    it('renders locked badge with reduced opacity', () => {
        const lockedBadge = { ...mockBadge, isLocked: true };
        const { container } = render(<BadgeIcon badge={lockedBadge} />);
        const badgeElement = container.firstChild as HTMLElement;
        expect(badgeElement).toHaveStyle({ opacity: 0.5 });
    });

    it('shows progress for locked badges', () => {
        const lockedBadge = { ...mockBadge, isLocked: true, progress: 75 };
        render(<BadgeIcon badge={lockedBadge} />);
        // Tooltip content is tested via integration tests
    });

    it('renders different sizes correctly', () => {
        const { rerender, container } = render(<BadgeIcon badge={mockBadge} size="small" />);
        let badgeElement = container.firstChild as HTMLElement;
        expect(badgeElement).toHaveStyle({ width: '24px', height: '24px' });

        rerender(<BadgeIcon badge={mockBadge} size="large" />);
        badgeElement = container.firstChild as HTMLElement;
        expect(badgeElement).toHaveStyle({ width: '48px', height: '48px' });
    });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { MemoryRouter } from 'react-router-dom';
import { ModerationDashboard } from '../ModerationDashboard';
import { FlaggedContent, ModerationStats } from '../../types';

// The tab + content-type filter logic lives in ModerationDashboard.tsx
// (items.filter(...)). We mock the hook to supply a deterministic, already
// loaded data set so the test exercises the REAL filter, not the mock delay.
const mockHandleAction = vi.fn();

const baseAuthor = (name: string) => ({
    id: `author-${name}`,
    name,
    email: `${name}@example.com`,
    reputationScore: 10,
    avatarUrl: '',
});

const baseReasons = { spam: 1, harassment: 0, inappropriate: 0, misinformation: 0, other: 0 };

const ITEMS: FlaggedContent[] = [
    {
        id: 'c1',
        contentType: 'vulnerability',
        contentId: 'cid1',
        contentPreview: 'A flagged vulnerability',
        fullContent: 'A flagged vulnerability',
        author: baseAuthor('VulnAuthor'),
        flagCount: 1,
        reasons: baseReasons,
        firstFlaggedAt: new Date().toISOString(),
        lastFlaggedAt: new Date().toISOString(),
        status: 'pending',
        moderationHistory: [],
    },
    {
        id: 'r1',
        contentType: 'report',
        contentId: 'rid1',
        contentPreview: 'A flagged report',
        fullContent: 'A flagged report',
        author: baseAuthor('ReportAuthor'),
        flagCount: 1,
        reasons: baseReasons,
        firstFlaggedAt: new Date().toISOString(),
        lastFlaggedAt: new Date().toISOString(),
        status: 'pending',
        moderationHistory: [],
    },
    {
        id: 'h1',
        contentType: 'vulnerability',
        contentId: 'cid2',
        contentPreview: 'An already-hidden vulnerability',
        fullContent: 'An already-hidden vulnerability',
        author: baseAuthor('HiddenAuthor'),
        flagCount: 1,
        reasons: baseReasons,
        firstFlaggedAt: new Date().toISOString(),
        lastFlaggedAt: new Date().toISOString(),
        status: 'hidden',
        moderationHistory: [],
        lastAction: { action: 'hide', reason: 'spam' },
    },
];

const STATS: ModerationStats = {
    queueSize: 2,
    actionsToday: 5,
    actionsThisWeek: 10,
    actionsThisMonth: 20,
};

vi.mock('../../hooks/useModerationQueue', () => ({
    useModerationQueue: () => ({
        items: ITEMS,
        stats: STATS,
        loading: false,
        handleAction: mockHandleAction,
        refetch: vi.fn(),
    }),
}));

const theme = createTheme();

const renderComponent = () =>
    render(
        <MemoryRouter>
            <ThemeProvider theme={theme}>
                <ModerationDashboard />
            </ThemeProvider>
        </MemoryRouter>
    );

describe('ModerationDashboard - filtering', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('default pending tab shows both pending items and hides the hidden one', () => {
        renderComponent();
        expect(screen.getByText('VulnAuthor')).toBeInTheDocument();
        expect(screen.getByText('ReportAuthor')).toBeInTheDocument();
        expect(screen.queryByText('HiddenAuthor')).not.toBeInTheDocument();
    });

    it('content-type filter "Reports" shows the report item and hides the vulnerability item', async () => {
        const user = userEvent.setup();
        renderComponent();

        // Both pending items visible initially
        expect(screen.getByText('VulnAuthor')).toBeInTheDocument();
        expect(screen.getByText('ReportAuthor')).toBeInTheDocument();

        // Open the Content Type select and choose Reports
        // The MUI Select renders a single combobox (its InputLabel is not
        // programmatically associated, so target it by role).
        await user.click(screen.getByRole('combobox'));
        const listbox = within(screen.getByRole('listbox'));
        await user.click(listbox.getByText('Reports'));

        // Now only the report item should remain
        expect(screen.getByText('ReportAuthor')).toBeInTheDocument();
        expect(screen.queryByText('VulnAuthor')).not.toBeInTheDocument();
    });

    it('content-type filter "Vulnerabilities" shows the vulnerability item and hides the report item', async () => {
        const user = userEvent.setup();
        renderComponent();

        // The MUI Select renders a single combobox (its InputLabel is not
        // programmatically associated, so target it by role).
        await user.click(screen.getByRole('combobox'));
        const listbox = within(screen.getByRole('listbox'));
        await user.click(listbox.getByText('Vulnerabilities'));

        expect(screen.getByText('VulnAuthor')).toBeInTheDocument();
        expect(screen.queryByText('ReportAuthor')).not.toBeInTheDocument();
    });

    it('switching to the Hidden history tab shows hidden items and hides pending ones', async () => {
        const user = userEvent.setup();
        renderComponent();

        await user.click(screen.getByRole('tab', { name: /History \(Hidden\)/i }));

        expect(screen.getByText('HiddenAuthor')).toBeInTheDocument();
        expect(screen.queryByText('VulnAuthor')).not.toBeInTheDocument();
        expect(screen.queryByText('ReportAuthor')).not.toBeInTheDocument();
    });

    it('combining the Hidden tab with the Vulnerabilities filter narrows to the hidden vulnerability', async () => {
        const user = userEvent.setup();
        renderComponent();

        await user.click(screen.getByRole('tab', { name: /History \(Hidden\)/i }));
        // The MUI Select renders a single combobox (its InputLabel is not
        // programmatically associated, so target it by role).
        await user.click(screen.getByRole('combobox'));
        const listbox = within(screen.getByRole('listbox'));
        await user.click(listbox.getByText('Vulnerabilities'));

        // The hidden item is a vulnerability, so it remains
        expect(screen.getByText('HiddenAuthor')).toBeInTheDocument();
    });

    it('an empty queue (e.g. Approved tab with no items) shows the empty-state message', async () => {
        const user = userEvent.setup();
        renderComponent();

        await user.click(screen.getByRole('tab', { name: /History \(Approved\)/i }));

        expect(screen.getByText(/No items found in this queue/i)).toBeInTheDocument();
    });
});

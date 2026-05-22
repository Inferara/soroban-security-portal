import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useModerationQueue } from '../useModerationQueue';
import type { FlaggedContent, ModerationStats } from '../../types';

vi.mock('../../../../api/soroban-security-portal/soroban-security-portal-api', () => ({
    getModerationQueueCall: vi.fn(),
    getModerationStatsCall: vi.fn(),
    takeModerationActionCall: vi.fn(),
}));

// Also mock the dialog handler so showError doesn't try to dispatch to a real Redux store
vi.mock('../../../dialog-handler/dialog-handler', () => ({
    showError: vi.fn(),
}));

import {
    getModerationQueueCall,
    getModerationStatsCall,
    takeModerationActionCall,
} from '../../../../api/soroban-security-portal/soroban-security-portal-api';
import { showError } from '../../../dialog-handler/dialog-handler';

const mockGetQueue = getModerationQueueCall as ReturnType<typeof vi.fn>;
const mockGetStats = getModerationStatsCall as ReturnType<typeof vi.fn>;
const mockTakeAction = takeModerationActionCall as ReturnType<typeof vi.fn>;
const mockShowError = showError as ReturnType<typeof vi.fn>;

const MOCK_ITEMS: FlaggedContent[] = [
    {
        id: 'vulnerability:5',
        contentType: 'vulnerability',
        contentId: '5',
        contentPreview: 'A flagged vulnerability',
        fullContent: 'Full content here',
        author: {
            id: 'u1',
            name: 'TestUser',
            email: 'test@example.com',
            reputationScore: 50,
            avatarUrl: '',
        },
        flagCount: 3,
        reasons: { spam: 1, harassment: 0, inappropriate: 0, misinformation: 2, other: 0 },
        firstFlaggedAt: new Date().toISOString(),
        lastFlaggedAt: new Date().toISOString(),
        status: 'pending',
        moderationHistory: [],
    },
    {
        id: 'report:10',
        contentType: 'report',
        contentId: '10',
        contentPreview: 'A flagged report',
        fullContent: 'Full report content',
        author: {
            id: 'u2',
            name: 'AnotherUser',
            email: 'another@example.com',
            reputationScore: 20,
            avatarUrl: '',
        },
        flagCount: 1,
        reasons: { spam: 1, harassment: 0, inappropriate: 0, misinformation: 0, other: 0 },
        firstFlaggedAt: new Date().toISOString(),
        lastFlaggedAt: new Date().toISOString(),
        status: 'pending',
        moderationHistory: [],
    },
];

const MOCK_STATS: ModerationStats = {
    queueSize: 2,
    actionsToday: 5,
    actionsThisWeek: 20,
    actionsThisMonth: 80,
};

beforeEach(() => {
    vi.clearAllMocks();
    mockGetQueue.mockResolvedValue(MOCK_ITEMS);
    mockGetStats.mockResolvedValue(MOCK_STATS);
    mockTakeAction.mockResolvedValue(true);
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('useModerationQueue', () => {
    describe('initial state', () => {
        it('starts in loading state with empty items and null stats', () => {
            const { result } = renderHook(() => useModerationQueue());
            expect(result.current.loading).toBe(true);
            expect(result.current.items).toHaveLength(0);
            expect(result.current.stats).toBeNull();
        });

        it('loads items from getModerationQueueCall on mount', async () => {
            const { result } = renderHook(() => useModerationQueue());
            await waitFor(() => expect(result.current.loading).toBe(false));
            expect(mockGetQueue).toHaveBeenCalledTimes(1);
            expect(result.current.items).toHaveLength(MOCK_ITEMS.length);
            expect(result.current.items[0].id).toBe('vulnerability:5');
        });

        it('loads stats from getModerationStatsCall on mount', async () => {
            const { result } = renderHook(() => useModerationQueue());
            await waitFor(() => expect(result.current.loading).toBe(false));
            expect(mockGetStats).toHaveBeenCalledTimes(1);
            expect(result.current.stats).toEqual(MOCK_STATS);
        });

        it('stats are null while loading', () => {
            // Delay resolution so loading stays true during check
            mockGetQueue.mockReturnValue(new Promise(() => {}));
            mockGetStats.mockReturnValue(new Promise(() => {}));
            const { result } = renderHook(() => useModerationQueue());
            expect(result.current.stats).toBeNull();
        });
    });

    describe('handleAction', () => {
        it('calls takeModerationActionCall with split contentType and numeric contentId', async () => {
            const { result } = renderHook(() => useModerationQueue());
            await waitFor(() => expect(result.current.loading).toBe(false));

            await act(async () => {
                await result.current.handleAction('vulnerability:5', 'hide', 'spam');
            });

            expect(mockTakeAction).toHaveBeenCalledWith('vulnerability', 5, 'hide', 'spam');
        });

        it('refetches queue after a successful action', async () => {
            const { result } = renderHook(() => useModerationQueue());
            await waitFor(() => expect(result.current.loading).toBe(false));
            // At this point queue was called once (mount)
            expect(mockGetQueue).toHaveBeenCalledTimes(1);

            await act(async () => {
                await result.current.handleAction('vulnerability:5', 'approve');
            });

            // Should have been called again after the action
            expect(mockGetQueue).toHaveBeenCalledTimes(2);
        });

        it('passes reason=undefined when not provided', async () => {
            const { result } = renderHook(() => useModerationQueue());
            await waitFor(() => expect(result.current.loading).toBe(false));

            await act(async () => {
                await result.current.handleAction('report:10', 'approve');
            });

            expect(mockTakeAction).toHaveBeenCalledWith('report', 10, 'approve', undefined);
        });

        it('rejects a malformed id without calling the API', async () => {
            const { result } = renderHook(() => useModerationQueue());
            await waitFor(() => expect(result.current.loading).toBe(false));

            await act(async () => {
                await result.current.handleAction('not-a-valid-id', 'hide', 'spam');
            });

            expect(mockTakeAction).not.toHaveBeenCalled();
            expect(mockShowError).toHaveBeenCalledWith('Invalid moderation item');
        });
    });

    describe('error handling', () => {
        it('stops loading and shows an error when the queue fetch fails', async () => {
            mockGetQueue.mockRejectedValue(new Error('boom'));
            const { result } = renderHook(() => useModerationQueue());

            await waitFor(() => expect(result.current.loading).toBe(false));
            expect(result.current.loading).toBe(false);
            expect(mockShowError).toHaveBeenCalled();
        });
    });
});

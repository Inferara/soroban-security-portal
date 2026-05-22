import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useModerationQueue } from '../useModerationQueue';

// Use fake timers to control the simulated API timeout
beforeEach(() => {
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
});

/** Helper: render the hook and advance past the 1-second mock delay. */
async function renderAndLoad() {
    const hook = renderHook(() => useModerationQueue());
    // Advance the simulated setTimeout(…, 1000) to resolve the mock load
    await act(async () => {
        vi.advanceTimersByTime(1000);
    });
    return hook;
}

describe('useModerationQueue', () => {
    describe('initial state', () => {
        it('starts in loading state with empty items and null stats', () => {
            const { result } = renderHook(() => useModerationQueue());
            expect(result.current.loading).toBe(true);
            expect(result.current.items).toHaveLength(0);
            expect(result.current.stats).toBeNull();
        });

        it('loads mock data after the simulated delay', async () => {
            const { result } = await renderAndLoad();
            expect(result.current.loading).toBe(false);
            expect(result.current.items.length).toBeGreaterThan(0);
            expect(result.current.stats).not.toBeNull();
        });

        it('all initial items have pending status', async () => {
            const { result } = await renderAndLoad();
            expect(result.current.items.every(i => i.status === 'pending')).toBe(true);
        });
    });

    describe('handleAction — status transitions', () => {
        it('approve: moves item from pending to approved', async () => {
            const { result } = await renderAndLoad();
            const targetId = result.current.items[0].id;

            act(() => {
                result.current.handleAction(targetId, 'approve');
            });

            const updated = result.current.items.find(i => i.id === targetId)!;
            expect(updated.status).toBe('approved');
        });

        it('hide: moves item from pending to hidden', async () => {
            const { result } = await renderAndLoad();
            const targetId = result.current.items[0].id;

            act(() => {
                result.current.handleAction(targetId, 'hide', 'spam');
            });

            const updated = result.current.items.find(i => i.id === targetId)!;
            expect(updated.status).toBe('hidden');
        });

        it('delete: moves item from pending to deleted', async () => {
            const { result } = await renderAndLoad();
            const targetId = result.current.items[0].id;

            act(() => {
                result.current.handleAction(targetId, 'delete', 'harassment');
            });

            const updated = result.current.items.find(i => i.id === targetId)!;
            expect(updated.status).toBe('deleted');
        });

        it('only affects the targeted item; others remain pending', async () => {
            const { result } = await renderAndLoad();
            const allIds = result.current.items.map(i => i.id);
            const targetId = allIds[0];
            const otherIds = allIds.slice(1);

            act(() => {
                result.current.handleAction(targetId, 'approve');
            });

            otherIds.forEach(id => {
                const item = result.current.items.find(i => i.id === id)!;
                expect(item.status).toBe('pending');
            });
        });
    });

    describe('handleAction — reason stored in lastAction', () => {
        it('stores the reason on the item when hiding', async () => {
            const { result } = await renderAndLoad();
            const targetId = result.current.items[0].id;

            act(() => {
                result.current.handleAction(targetId, 'hide', 'spam');
            });

            const updated = result.current.items.find(i => i.id === targetId)!;
            expect(updated.lastAction?.action).toBe('hide');
            expect(updated.lastAction?.reason).toBe('spam');
        });

        it('stores the reason on the item when deleting', async () => {
            const { result } = await renderAndLoad();
            const targetId = result.current.items[0].id;

            act(() => {
                result.current.handleAction(targetId, 'delete', 'misinformation');
            });

            const updated = result.current.items.find(i => i.id === targetId)!;
            expect(updated.lastAction?.action).toBe('delete');
            expect(updated.lastAction?.reason).toBe('misinformation');
        });

        it('stores action without reason for approve', async () => {
            const { result } = await renderAndLoad();
            const targetId = result.current.items[0].id;

            act(() => {
                result.current.handleAction(targetId, 'approve');
            });

            const updated = result.current.items.find(i => i.id === targetId)!;
            expect(updated.lastAction?.action).toBe('approve');
            expect(updated.lastAction?.reason).toBeUndefined();
        });
    });

    describe('status transitions remove items from the pending set', () => {
        it('after hiding one item, the hidden item no longer has pending status', async () => {
            const { result } = await renderAndLoad();
            const targetId = result.current.items[0].id;

            act(() => {
                result.current.handleAction(targetId, 'hide', 'spam');
            });

            const pendingItems = result.current.items.filter(i => i.status === 'pending');
            expect(pendingItems.find(i => i.id === targetId)).toBeUndefined();
        });

        it('after approving all items, zero remain pending', async () => {
            const { result } = await renderAndLoad();
            const ids = result.current.items.map(i => i.id);

            act(() => {
                ids.forEach(id => result.current.handleAction(id, 'approve'));
            });

            const pending = result.current.items.filter(i => i.status === 'pending');
            expect(pending.length).toBe(0);
        });
    });

    describe('stats recalculation', () => {
        it('stats.queueSize equals number of pending items initially', async () => {
            const { result } = await renderAndLoad();
            const pendingCount = result.current.items.filter(i => i.status === 'pending').length;
            expect(result.current.stats!.queueSize).toBe(pendingCount);
        });

        it('stats.queueSize decrements after approving one item', async () => {
            const { result } = await renderAndLoad();
            const initialQueue = result.current.stats!.queueSize;
            const targetId = result.current.items[0].id;

            act(() => {
                result.current.handleAction(targetId, 'approve');
            });

            expect(result.current.stats!.queueSize).toBe(initialQueue - 1);
        });

        it('actionsToday increments after each action', async () => {
            const { result } = await renderAndLoad();
            const baseline = result.current.stats!.actionsToday;
            const targetId = result.current.items[0].id;

            act(() => {
                result.current.handleAction(targetId, 'hide', 'spam');
            });

            expect(result.current.stats!.actionsToday).toBe(baseline + 1);
        });

        it('actionsThisWeek and actionsThisMonth also increment after an action', async () => {
            const { result } = await renderAndLoad();
            const baseWeek = result.current.stats!.actionsThisWeek;
            const baseMonth = result.current.stats!.actionsThisMonth;
            const targetId = result.current.items[0].id;

            act(() => {
                result.current.handleAction(targetId, 'delete', 'spam');
            });

            expect(result.current.stats!.actionsThisWeek).toBe(baseWeek + 1);
            expect(result.current.stats!.actionsThisMonth).toBe(baseMonth + 1);
        });

        it('stats are null while loading', () => {
            const { result } = renderHook(() => useModerationQueue());
            expect(result.current.stats).toBeNull();
        });
    });

    describe('mock avatar URLs (L-7)', () => {
        it('no item author has a third-party avatar URL', async () => {
            const { result } = await renderAndLoad();
            result.current.items.forEach(item => {
                const url = item.author.avatarUrl ?? '';
                expect(url).not.toMatch(/^https?:\/\//);
            });
        });
    });
});

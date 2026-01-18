import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { useAdminList, CustomOperationsRecord } from '../useAdminList';
import currentPageReducer from '../../../features/pages/admin/admin-main-window/current-page-slice';
import currentErrorReducer from '../../../features/pages/admin/admin-main-window/current-error-slice';

// Create test store
const createTestStore = () => {
  return configureStore({
    reducer: {
      currentPage: currentPageReducer,
      currentError: currentErrorReducer,
    },
  });
};

// Create wrapper with Redux provider
const createWrapper = () => {
  const store = createTestStore();
  return ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
};

// Mock data
interface TestEntity {
  id: number;
  name: string;
}

const mockData: TestEntity[] = [
  { id: 1, name: 'Entity 1' },
  { id: 2, name: 'Entity 2' },
  { id: 3, name: 'Entity 3' },
];

const currentPageState = {
  pageName: 'Test Entities',
  pageCode: 'test-entities',
  pageUrl: '/admin/test-entities',
  routePath: 'admin/test-entities',
};

describe('useAdminList', () => {
  let mockFetchData: ReturnType<typeof vi.fn>;
  let mockRemoveItem: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetchData = vi.fn().mockResolvedValue(mockData);
    mockRemoveItem = vi.fn().mockResolvedValue(undefined);
  });

  describe('initial state and data fetching', () => {
    it('fetches data on mount', async () => {
      const wrapper = createWrapper();

      const { result } = renderHook(
        () =>
          useAdminList({
            fetchData: mockFetchData,
            removeItem: mockRemoveItem,
            currentPageState,
          }),
        { wrapper }
      );

      // Initial state should be loading
      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockFetchData).toHaveBeenCalledTimes(1);
      expect(result.current.data).toEqual(mockData);
      expect(result.current.error).toBeNull();
    });

    it('handles fetch error', async () => {
      const errorMessage = 'Network error';
      mockFetchData.mockRejectedValue(new Error(errorMessage));

      const wrapper = createWrapper();

      const { result } = renderHook(
        () =>
          useAdminList({
            fetchData: mockFetchData,
            removeItem: mockRemoveItem,
            currentPageState,
          }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe(errorMessage);
      expect(result.current.data).toEqual([]);
    });

    it('handles non-Error fetch failure', async () => {
      mockFetchData.mockRejectedValue('String error');

      const wrapper = createWrapper();

      const { result } = renderHook(
        () =>
          useAdminList({
            fetchData: mockFetchData,
            removeItem: mockRemoveItem,
            currentPageState,
          }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Failed to fetch data');
    });
  });

  describe('remove functionality', () => {
    it('removes item and refreshes list', async () => {
      const wrapper = createWrapper();

      const { result } = renderHook(
        () =>
          useAdminList({
            fetchData: mockFetchData,
            removeItem: mockRemoveItem,
            currentPageState,
          }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Reset the fetch call count
      mockFetchData.mockClear();

      await act(async () => {
        await result.current.remove(1);
      });

      expect(mockRemoveItem).toHaveBeenCalledWith(1);
      expect(mockFetchData).toHaveBeenCalledTimes(1); // Should refresh after remove
    });

    it('calls removeItem with correct ID', async () => {
      const wrapper = createWrapper();

      const { result } = renderHook(
        () =>
          useAdminList({
            fetchData: mockFetchData,
            removeItem: mockRemoveItem,
            currentPageState,
          }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.remove(42);
      });

      expect(mockRemoveItem).toHaveBeenCalledWith(42);
    });
  });

  describe('refresh functionality', () => {
    it('manually refreshes data', async () => {
      const wrapper = createWrapper();

      const { result } = renderHook(
        () =>
          useAdminList({
            fetchData: mockFetchData,
            removeItem: mockRemoveItem,
            currentPageState,
          }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Clear fetch count and update mock data
      mockFetchData.mockClear();
      const newData = [...mockData, { id: 4, name: 'Entity 4' }];
      mockFetchData.mockResolvedValue(newData);

      await act(async () => {
        await result.current.refresh();
      });

      expect(mockFetchData).toHaveBeenCalledTimes(1);
      expect(result.current.data).toEqual(newData);
    });

    it('clears previous error on refresh', async () => {
      mockFetchData.mockRejectedValue(new Error('Initial error'));

      const wrapper = createWrapper();

      const { result } = renderHook(
        () =>
          useAdminList({
            fetchData: mockFetchData,
            removeItem: mockRemoveItem,
            currentPageState,
          }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.error).toBe('Initial error');
      });

      // Fix the fetch for refresh
      mockFetchData.mockResolvedValue(mockData);

      await act(async () => {
        await result.current.refresh();
      });

      expect(result.current.error).toBeNull();
      expect(result.current.data).toEqual(mockData);
    });
  });

  describe('custom operations', () => {
    it('handles custom operation with refresh', async () => {
      const mockApprove = vi.fn().mockResolvedValue(undefined);

      const customOperations = {
        approve: { handler: mockApprove },
      };

      const wrapper = createWrapper();

      const { result } = renderHook(
        () =>
          useAdminList<TestEntity, typeof customOperations>({
            fetchData: mockFetchData,
            removeItem: mockRemoveItem,
            currentPageState,
            customOperations,
          }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      mockFetchData.mockClear();

      await act(async () => {
        await result.current.operations.approve(123);
      });

      expect(mockApprove).toHaveBeenCalledWith(123);
      expect(mockFetchData).toHaveBeenCalledTimes(1); // Should refresh
    });

    it('handles custom operation without refresh', async () => {
      const mockToggle = vi.fn().mockResolvedValue(undefined);

      const customOperations = {
        toggle: { handler: mockToggle, refreshAfter: false },
      };

      const wrapper = createWrapper();

      const { result } = renderHook(
        () =>
          useAdminList<TestEntity, typeof customOperations>({
            fetchData: mockFetchData,
            removeItem: mockRemoveItem,
            currentPageState,
            customOperations,
          }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      mockFetchData.mockClear();

      await act(async () => {
        await result.current.operations.toggle(456);
      });

      expect(mockToggle).toHaveBeenCalledWith(456);
      expect(mockFetchData).not.toHaveBeenCalled(); // Should not refresh
    });

    it('handles multiple custom operations', async () => {
      const mockApprove = vi.fn().mockResolvedValue(undefined);
      const mockReject = vi.fn().mockResolvedValue(undefined);

      const customOperations = {
        approve: { handler: mockApprove },
        reject: { handler: mockReject },
      };

      const wrapper = createWrapper();

      const { result } = renderHook(
        () =>
          useAdminList<TestEntity, typeof customOperations>({
            fetchData: mockFetchData,
            removeItem: mockRemoveItem,
            currentPageState,
            customOperations,
          }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.operations).toHaveProperty('approve');
      expect(result.current.operations).toHaveProperty('reject');
    });

    it('returns empty operations object when no custom operations provided', async () => {
      const wrapper = createWrapper();

      const { result } = renderHook(
        () =>
          useAdminList({
            fetchData: mockFetchData,
            removeItem: mockRemoveItem,
            currentPageState,
          }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.operations).toEqual({});
    });
  });

  describe('loading state transitions', () => {
    it('sets loading true during fetch', async () => {
      let resolvePromise: (value: TestEntity[]) => void;
      const slowFetch = new Promise<TestEntity[]>((resolve) => {
        resolvePromise = resolve;
      });
      mockFetchData.mockReturnValue(slowFetch);

      const wrapper = createWrapper();

      const { result } = renderHook(
        () =>
          useAdminList({
            fetchData: mockFetchData,
            removeItem: mockRemoveItem,
            currentPageState,
          }),
        { wrapper }
      );

      // Should be loading
      expect(result.current.loading).toBe(true);

      // Resolve the promise
      await act(async () => {
        resolvePromise!(mockData);
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it('sets loading true during refresh', async () => {
      const wrapper = createWrapper();

      const { result } = renderHook(
        () =>
          useAdminList({
            fetchData: mockFetchData,
            removeItem: mockRemoveItem,
            currentPageState,
          }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Set up slow refresh
      let resolveRefresh: (value: TestEntity[]) => void;
      const slowRefresh = new Promise<TestEntity[]>((resolve) => {
        resolveRefresh = resolve;
      });
      mockFetchData.mockReturnValue(slowRefresh);

      // Start refresh
      act(() => {
        result.current.refresh();
      });

      // Should be loading during refresh
      expect(result.current.loading).toBe(true);

      // Complete refresh
      await act(async () => {
        resolveRefresh!(mockData);
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });
  });
});

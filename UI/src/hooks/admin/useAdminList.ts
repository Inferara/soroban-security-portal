import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAppDispatch } from '../../app/hooks';
import { CurrentPageState, setCurrentPage } from '../../features/pages/admin/admin-main-window/current-page-slice';

/**
 * Configuration for a custom operation
 */
export interface CustomOperation {
  /** The API function to call */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: (...args: any[]) => Promise<unknown>;
  /** Whether to refresh the list after the operation completes (default: true) */
  refreshAfter?: boolean;
}

/**
 * Base type for custom operations record
 */
export type CustomOperationsRecord = Record<string, CustomOperation>;

/**
 * Configuration for the useAdminList hook
 */
export interface UseAdminListConfig<T, TOperations extends CustomOperationsRecord = Record<string, never>> {
  /** Function to fetch the list data */
  fetchData: () => Promise<T[]>;
  /** Function to remove an item by ID (can return void or boolean) */
  removeItem: (id: number) => Promise<void> | Promise<boolean>;
  /** Current page state for navigation tracking */
  currentPageState: CurrentPageState;
  /** Custom operations beyond remove (e.g., approve, reject, enable/disable) */
  customOperations?: TOperations;
}

/**
 * Type to extract the handler function signature from a CustomOperation
 */
type OperationHandler<T> = T extends CustomOperation
  ? (...args: unknown[]) => Promise<void>
  : never;

/**
 * Type to create operation handlers from custom operations config
 */
type OperationHandlers<T extends CustomOperationsRecord> = {
  [K in keyof T]: OperationHandler<T[K]>;
};

/**
 * Return type for useAdminList hook
 */
export interface UseAdminListResult<T, TOperations extends CustomOperationsRecord = Record<string, never>> {
  /** The fetched list data */
  data: T[];
  /** Whether data is currently loading */
  loading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Function to remove an item and refresh the list */
  remove: (id: number) => Promise<void>;
  /** Function to manually refresh the list */
  refresh: () => Promise<void>;
  /** Custom operation handlers */
  operations: OperationHandlers<TOperations>;
}

/**
 * useAdminList - A generic hook for admin list pages.
 *
 * This hook eliminates code duplication across admin list hooks by providing:
 * - Standardized data fetching on mount
 * - Current page state management
 * - Remove item functionality with auto-refresh
 * - Loading and error states
 * - Custom operations (approve, reject, enable/disable, etc.)
 *
 * @example Basic usage:
 * ```tsx
 * const { data, remove, loading } = useAdminList({
 *   fetchData: getAuditorListDataCall,
 *   removeItem: removeAuditorCall,
 *   currentPageState: {
 *     pageName: 'Auditors',
 *     pageCode: 'auditors',
 *     pageUrl: window.location.pathname,
 *     routePath: 'admin/auditors',
 *   }
 * });
 * ```
 *
 * @example With custom operations:
 * ```tsx
 * const { data, remove, operations } = useAdminList({
 *   fetchData: getVulnerabilityListDataCall,
 *   removeItem: removeVulnerabilityCall,
 *   currentPageState: { ... },
 *   customOperations: {
 *     approve: { handler: approveVulnerabilityCall },
 *     reject: { handler: rejectVulnerabilityCall },
 *   }
 * });
 * // Use: await operations.approve(id);
 * ```
 *
 * @example With non-refreshing operation:
 * ```tsx
 * const { data, operations } = useAdminList({
 *   fetchData: getUserListDataCall,
 *   removeItem: removeUserCall,
 *   currentPageState: { ... },
 *   customOperations: {
 *     toggleEnabled: { handler: userToggleCall, refreshAfter: false },
 *   }
 * });
 * ```
 */
export function useAdminList<
  T,
  TOperations extends CustomOperationsRecord = Record<string, never>
>(config: UseAdminListConfig<T, TOperations>): UseAdminListResult<T, TOperations> {
  const { fetchData, removeItem, currentPageState, customOperations } = config;
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const dispatch = useAppDispatch();

  const refresh = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetchData();
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [fetchData]);

  const remove = useCallback(async (id: number): Promise<void> => {
    await removeItem(id);
    await refresh();
  }, [removeItem, refresh]);

  // Create wrapped operation handlers that optionally refresh after execution
  const operations = useMemo(() => {
    if (!customOperations) {
      return {} as OperationHandlers<TOperations>;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handlers: Record<string, (...args: any[]) => Promise<void>> = {};

    for (const [key, operation] of Object.entries(customOperations)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      handlers[key] = async (...args: any[]): Promise<void> => {
        await operation.handler(...args);
        // Default to refreshing after operation unless explicitly set to false
        if (operation.refreshAfter !== false) {
          await refresh();
        }
      };
    }

    return handlers as OperationHandlers<TOperations>;
  }, [customOperations, refresh]);

  // Set the current page and fetch data on mount
  useEffect(() => {
    dispatch(setCurrentPage(currentPageState));
    void refresh();
  }, [dispatch, currentPageState, refresh]);

  return {
    data,
    loading,
    error,
    remove,
    refresh,
    operations,
  };
}

import { ReactNode, useState, useMemo, useCallback } from 'react';
import { Box, CircularProgress, IconButton, Stack, Tooltip } from '@mui/material';
import { DataGrid, GridColDef, GridValidRowModel } from '@mui/x-data-grid';
import ClearIcon from '@mui/icons-material/Clear';
import { useNavigate } from 'react-router-dom';
import { useAuth } from 'react-oidc-context';

import { CustomToolbar } from '../../features/components/custom-toolbar';
import { ConfirmDialog } from '../../features/pages/admin/admin-main-window/confirm-dialog';
import { Role } from '../../api/soroban-security-portal/models/role';
import { defaultUiSettings } from '../../api/soroban-security-portal/models/ui-settings';

/**
 * Configuration for the add button in the toolbar
 */
export interface AddButtonConfig {
  /** Path to navigate to when add button is clicked */
  path: string;
  /** Icon component to display */
  icon: ReactNode;
  /** Tooltip text */
  tooltip: string;
}

/**
 * Configuration for the remove action column
 */
export interface RemoveActionConfig {
  /** Tooltip text for remove button */
  tooltip: string;
  /** Function to extract the ID from a row for removal */
  getRowId?: (row: GridValidRowModel) => number;
  /** Whether only admins can remove items (default: true) */
  adminOnly?: boolean;
}

/**
 * Configuration for the confirm dialog
 */
export interface ConfirmDialogConfig {
  /** Dialog title */
  title: string;
  /** Dialog message */
  message: string;
}

/**
 * Props for AdminDataGrid component
 */
export interface AdminDataGridProps<T extends GridValidRowModel> {
  /** Array of data rows to display */
  rows: T[];
  /** Column definitions for the grid */
  columns: GridColDef[];
  /** Function to get unique row identifier */
  getRowId: (row: T) => number | string;
  /** Callback when an item is confirmed for removal (can return void or boolean) */
  onRemove: (id: number) => Promise<void> | Promise<boolean>;
  /** Configuration for the add button */
  addButton: AddButtonConfig;
  /** Configuration for remove action (optional - if not provided, no remove column is added) */
  removeAction?: RemoveActionConfig;
  /** Configuration for confirm dialog */
  confirmDialog: ConfirmDialogConfig;
  /** Additional toolbar actions */
  additionalToolbarActions?: ReactNode;
  /** Custom sx props for the DataGrid */
  gridSx?: object;
  /** Whether to show transparent background (default: true for consistency) */
  transparentBackground?: boolean;
  /** Additional content to render after the grid (e.g., modals) */
  additionalContent?: ReactNode;
  /** Whether data is currently loading */
  loading?: boolean;
  /**
   * Controlled item ID to remove (optional).
   * When provided, the parent component controls the confirm dialog state.
   * Use with onItemIdToRemoveChange for full controlled behavior.
   */
  itemIdToRemove?: number;
  /**
   * Callback when item ID to remove changes (optional).
   * Called with the new ID when remove is triggered, or 0 when dialog is closed.
   */
  onItemIdToRemoveChange?: (id: number) => void;
}

/**
 * AdminDataGrid - A reusable data grid component for admin list pages.
 *
 * This component eliminates code duplication across admin list views by providing:
 * - Standardized layout with toolbar and data grid
 * - Add button with navigation
 * - Remove action column (admin-only by default)
 * - Confirmation dialog for deletions
 * - Consistent styling
 *
 * @example Basic usage with internal state management:
 * ```tsx
 * <AdminDataGrid
 *   rows={auditorListData}
 *   columns={columnsData}
 *   getRowId={(row) => row.id}
 *   onRemove={auditorRemove}
 *   addButton={{
 *     path: '/admin/auditors/add',
 *     icon: <PersonAddIcon sx={{ color: 'green' }} />,
 *     tooltip: 'Add Auditor'
 *   }}
 *   removeAction={{
 *     tooltip: 'Remove Auditor'
 *   }}
 *   confirmDialog={{
 *     title: 'Remove Auditor',
 *     message: 'Are you sure you want to remove this Auditor?'
 *   }}
 * />
 * ```
 *
 * @example Controlled mode with custom action columns:
 * ```tsx
 * const [removeId, setRemoveId] = useState(0);
 *
 * <AdminDataGrid
 *   rows={reportListData}
 *   columns={columnsWithCustomActions}
 *   getRowId={(row) => row.id}
 *   onRemove={reportRemove}
 *   addButton={{ ... }}
 *   confirmDialog={{ ... }}
 *   itemIdToRemove={removeId}
 *   onItemIdToRemoveChange={setRemoveId}
 * />
 * ```
 */
export function AdminDataGrid<T extends GridValidRowModel>({
  rows,
  columns,
  getRowId,
  onRemove,
  addButton,
  removeAction,
  confirmDialog,
  additionalToolbarActions,
  gridSx,
  transparentBackground = true,
  additionalContent,
  loading = false,
  itemIdToRemove: controlledItemIdToRemove,
  onItemIdToRemoveChange,
}: AdminDataGridProps<T>) {
  const navigate = useNavigate();
  const auth = useAuth();

  // Internal state for uncontrolled mode
  const [internalItemIdToRemove, setInternalItemIdToRemove] = useState<number>(0);

  // Use controlled value if provided, otherwise use internal state
  const isControlled = controlledItemIdToRemove !== undefined;
  const itemIdToRemove = isControlled ? controlledItemIdToRemove : internalItemIdToRemove;

  const handleSetItemIdToRemove = useCallback((id: number) => {
    if (isControlled && onItemIdToRemoveChange) {
      onItemIdToRemoveChange(id);
    } else {
      setInternalItemIdToRemove(id);
    }
  }, [isControlled, onItemIdToRemoveChange]);

  const isAdmin = auth.user?.profile.role === Role.Admin;

  const handleRemoveConfirmed = async () => {
    await onRemove(itemIdToRemove);
    handleSetItemIdToRemove(0);
  };

  // Build columns with optional remove action - memoized to prevent unnecessary recalculations
  const finalColumns = useMemo((): GridColDef[] => {
    const resultColumns: GridColDef[] = [];

    // Add remove action column if configured and user has permission
    if (removeAction) {
      const showRemoveAction = removeAction.adminOnly !== false ? isAdmin : true;

      if (showRemoveAction) {
        resultColumns.push({
          field: 'actions',
          headerName: 'Actions',
          width: 80,
          sortable: false,
          filterable: false,
          renderCell: (params) => {
            const rowId = removeAction.getRowId
              ? removeAction.getRowId(params.row)
              : params.row.id;
            return (
              <Tooltip title={removeAction.tooltip}>
                <IconButton
                  onClick={() => handleSetItemIdToRemove(rowId)}
                  aria-label={removeAction.tooltip}
                >
                  <ClearIcon sx={{ color: 'red' }} />
                </IconButton>
              </Tooltip>
            );
          },
        });
      }
    }

    return [...resultColumns, ...columns];
  }, [removeAction, isAdmin, columns, handleSetItemIdToRemove]);

  const defaultGridSx = useMemo(() => ({
    ...(transparentBackground && { backgroundColor: 'transparent' }),
    '& .MuiDataGrid-cell': {
      whiteSpace: 'normal',
      display: 'grid',
      alignContent: 'center',
      minHeight: 50,
    },
  }), [transparentBackground]);

  return (
    <div style={defaultUiSettings.listAreaStyle}>
      <Stack direction="row" spacing={2}>
        <Tooltip title={addButton.tooltip}>
          <IconButton onClick={() => navigate(addButton.path)}>
            {addButton.icon}
          </IconButton>
        </Tooltip>
        {additionalToolbarActions}
      </Stack>

      <div style={{ height: 'calc(100vh - 128px)', position: 'relative' }}>
        {loading && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.7)',
              zIndex: 1,
            }}
          >
            <CircularProgress />
          </Box>
        )}
        <DataGrid
          getRowId={getRowId}
          getRowHeight={() => 'auto'}
          sx={{ ...defaultGridSx, ...gridSx }}
          rows={rows}
          columns={finalColumns}
          showToolbar={true}
          slots={{
            toolbar: CustomToolbar,
          }}
          isRowSelectable={() => false}
          loading={loading}
        />
      </div>

      <ConfirmDialog
        title={confirmDialog.title}
        message={confirmDialog.message}
        okButtonText="Yes"
        cancelButtonText="No"
        onConfirm={handleRemoveConfirmed}
        onCancel={() => handleSetItemIdToRemove(0)}
        show={itemIdToRemove !== 0}
      />

      {additionalContent}
    </div>
  );
}

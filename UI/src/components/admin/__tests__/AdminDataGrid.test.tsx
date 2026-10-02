import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AdminDataGrid } from '../AdminDataGrid';
import { ResponsiveColumn } from '../responsive-columns';

// Mock react-oidc-context
vi.mock('react-oidc-context', () => ({
  useAuth: () => ({
    user: {
      profile: {
        role: ['Admin'],
      },
    },
    isAuthenticated: true,
  }),
}));

interface TestItem {
  id: number;
  name: string;
  status: string;
}

const testColumns: ResponsiveColumn[] = [
  { field: 'name', headerName: 'Name', width: 150 },
  { field: 'status', headerName: 'Status', width: 100 },
];

const testRows: TestItem[] = [
  { id: 1, name: 'Item 1', status: 'Active' },
  { id: 2, name: 'Item 2', status: 'Pending' },
];

describe('AdminDataGrid Column Persistence', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it('renders correctly with default column widths', () => {
    render(
      <BrowserRouter>
        <AdminDataGrid<TestItem>
          rows={testRows}
          columns={testColumns}
          getRowId={(row) => row.id}
          onRemove={vi.fn()}
          addButton={{ path: '/add', icon: <span>Add</span>, tooltip: 'Add' }}
          confirmDialog={{ title: 'Remove', message: 'Confirm?' }}
        />
      </BrowserRouter>
    );

    expect(screen.getByText('Name')).toBeDefined();
    expect(screen.getByText('Status')).toBeDefined();
    expect(screen.getByText('Item 1')).toBeDefined();
  });

  it('preserves user resized column widths in sessionStorage', () => {
    const pageKey = window.location.pathname.replace(/[^a-zA-Z0-9_-]/g, '_');
    const storageKey = `admin_grid_col_widths_${pageKey}`;
    
    // Simulate pre-existing resized column widths from previous actions (e.g. approve vulnerability)
    sessionStorage.setItem(storageKey, JSON.stringify({ name: 280, status: 190 }));

    const { rerender } = render(
      <BrowserRouter>
        <AdminDataGrid<TestItem>
          rows={testRows}
          columns={testColumns}
          getRowId={(row) => row.id}
          onRemove={vi.fn()}
          addButton={{ path: '/add', icon: <span>Add</span>, tooltip: 'Add' }}
          confirmDialog={{ title: 'Remove', message: 'Confirm?' }}
        />
      </BrowserRouter>
    );

    // Verify row updates (like after approval) still preserve the persisted table sizing
    const updatedRows = [{ id: 1, name: 'Item 1 (Approved)', status: 'Approved' }];
    rerender(
      <BrowserRouter>
        <AdminDataGrid<TestItem>
          rows={updatedRows}
          columns={testColumns}
          getRowId={(row) => row.id}
          onRemove={vi.fn()}
          addButton={{ path: '/add', icon: <span>Add</span>, tooltip: 'Add' }}
          confirmDialog={{ title: 'Remove', message: 'Confirm?' }}
        />
      </BrowserRouter>
    );

    expect(screen.getByText('Item 1 (Approved)')).toBeDefined();
    const stored = JSON.parse(sessionStorage.getItem(storageKey) || '{}');
    expect(stored.name).toBe(280);
    expect(stored.status).toBe(190);
  });
});

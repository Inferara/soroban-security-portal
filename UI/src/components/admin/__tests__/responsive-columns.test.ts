import { describe, it, expect } from 'vitest';
import { getResponsiveColumns, ResponsiveColumn, ColumnPriority } from '../responsive-columns';

describe('responsive-columns', () => {
  // Sample columns for testing
  const createTestColumns = (): ResponsiveColumn[] => [
    {
      field: 'name',
      headerName: 'Name',
      width: 200,
      mobileWidth: 120,
      priority: 'essential',
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 150,
      priority: 'important',
    },
    {
      field: 'description',
      headerName: 'Description',
      width: 300,
      priority: 'optional',
    },
    {
      field: 'date',
      headerName: 'Date',
      width: 150,
      priority: 'optional',
      hideOnMobile: true,
      hideOnTablet: true,
    },
  ];

  describe('getResponsiveColumns', () => {
    describe('mobile breakpoint (xs)', () => {
      it('shows only essential columns on mobile', () => {
        const columns = createTestColumns();
        const result = getResponsiveColumns(columns, 'xs');

        expect(result).toHaveLength(1);
        expect(result[0].field).toBe('name');
      });

      it('hides important columns on mobile by default', () => {
        const columns = createTestColumns();
        const result = getResponsiveColumns(columns, 'xs');

        const statusColumn = result.find(c => c.field === 'status');
        expect(statusColumn).toBeUndefined();
      });

      it('hides optional columns on mobile', () => {
        const columns = createTestColumns();
        const result = getResponsiveColumns(columns, 'xs');

        const descColumn = result.find(c => c.field === 'description');
        expect(descColumn).toBeUndefined();
      });

      it('applies mobileWidth when specified', () => {
        const columns = createTestColumns();
        const result = getResponsiveColumns(columns, 'xs');

        const nameColumn = result.find(c => c.field === 'name');
        expect(nameColumn?.minWidth).toBe(120);
        expect(nameColumn?.width).toBeUndefined();
        expect(nameColumn?.flex).toBe(1);
      });

      it('applies flex to columns without mobileWidth', () => {
        const columns: ResponsiveColumn[] = [
          { field: 'test', headerName: 'Test', width: 200, priority: 'essential' },
        ];
        const result = getResponsiveColumns(columns, 'xs');

        expect(result[0].flex).toBe(1);
      });
    });

    describe('mobile breakpoint (sm)', () => {
      it('treats sm same as xs for visibility', () => {
        const columns = createTestColumns();
        const resultXs = getResponsiveColumns(columns, 'xs');
        const resultSm = getResponsiveColumns(columns, 'sm');

        expect(resultXs.length).toBe(resultSm.length);
        expect(resultXs.map(c => c.field)).toEqual(resultSm.map(c => c.field));
      });
    });

    describe('tablet breakpoint (md)', () => {
      it('shows essential and important columns on tablet', () => {
        const columns = createTestColumns();
        const result = getResponsiveColumns(columns, 'md');

        expect(result).toHaveLength(2);
        expect(result.map(c => c.field)).toContain('name');
        expect(result.map(c => c.field)).toContain('status');
      });

      it('hides optional columns on tablet', () => {
        const columns = createTestColumns();
        const result = getResponsiveColumns(columns, 'md');

        const descColumn = result.find(c => c.field === 'description');
        expect(descColumn).toBeUndefined();
      });

      it('respects explicit hideOnTablet flag', () => {
        const columns = createTestColumns();
        const result = getResponsiveColumns(columns, 'md');

        const dateColumn = result.find(c => c.field === 'date');
        expect(dateColumn).toBeUndefined();
      });

      it('preserves original width on tablet', () => {
        const columns = createTestColumns();
        const result = getResponsiveColumns(columns, 'md');

        const nameColumn = result.find(c => c.field === 'name');
        expect(nameColumn?.width).toBe(200);
      });
    });

    describe('desktop breakpoints (lg, xl)', () => {
      it('shows all columns on desktop (lg)', () => {
        const columns = createTestColumns();
        const result = getResponsiveColumns(columns, 'lg');

        expect(result).toHaveLength(4);
      });

      it('shows all columns on desktop (xl)', () => {
        const columns = createTestColumns();
        const result = getResponsiveColumns(columns, 'xl');

        expect(result).toHaveLength(4);
      });

      it('preserves original column widths', () => {
        const columns = createTestColumns();
        const result = getResponsiveColumns(columns, 'lg');

        expect(result.find(c => c.field === 'name')?.width).toBe(200);
        expect(result.find(c => c.field === 'status')?.width).toBe(150);
        expect(result.find(c => c.field === 'description')?.width).toBe(300);
      });
    });

    describe('explicit hide flags', () => {
      it('hideOnMobile takes precedence over priority', () => {
        const columns: ResponsiveColumn[] = [
          {
            field: 'test',
            headerName: 'Test',
            width: 200,
            priority: 'essential',
            hideOnMobile: true,
          },
        ];
        const result = getResponsiveColumns(columns, 'xs');

        expect(result).toHaveLength(0);
      });

      it('hideOnMobile: false overrides priority auto-hiding', () => {
        const columns: ResponsiveColumn[] = [
          {
            field: 'test',
            headerName: 'Test',
            width: 200,
            priority: 'optional',
            hideOnMobile: false,
          },
        ];
        const result = getResponsiveColumns(columns, 'xs');

        expect(result).toHaveLength(1);
        expect(result[0].field).toBe('test');
      });

      it('hideOnTablet takes precedence over priority', () => {
        const columns: ResponsiveColumn[] = [
          {
            field: 'test',
            headerName: 'Test',
            width: 200,
            priority: 'important',
            hideOnTablet: true,
          },
        ];
        const result = getResponsiveColumns(columns, 'md');

        expect(result).toHaveLength(0);
      });

      it('hideOnTablet: false overrides priority auto-hiding', () => {
        const columns: ResponsiveColumn[] = [
          {
            field: 'test',
            headerName: 'Test',
            width: 200,
            priority: 'optional',
            hideOnTablet: false,
          },
        ];
        const result = getResponsiveColumns(columns, 'md');

        expect(result).toHaveLength(1);
      });
    });

    describe('priority defaults', () => {
      it('defaults to essential when priority not specified', () => {
        const columns: ResponsiveColumn[] = [
          { field: 'test', headerName: 'Test', width: 200 },
        ];
        const result = getResponsiveColumns(columns, 'xs');

        expect(result).toHaveLength(1);
      });
    });

    describe('removes custom properties', () => {
      it('strips priority from output columns', () => {
        const columns: ResponsiveColumn[] = [
          { field: 'test', headerName: 'Test', width: 200, priority: 'essential' },
        ];
        const result = getResponsiveColumns(columns, 'lg');

        expect(result[0]).not.toHaveProperty('priority');
      });

      it('strips hideOnMobile from output columns', () => {
        const columns: ResponsiveColumn[] = [
          { field: 'test', headerName: 'Test', width: 200, hideOnMobile: false },
        ];
        const result = getResponsiveColumns(columns, 'lg');

        expect(result[0]).not.toHaveProperty('hideOnMobile');
      });

      it('strips hideOnTablet from output columns', () => {
        const columns: ResponsiveColumn[] = [
          { field: 'test', headerName: 'Test', width: 200, hideOnTablet: false },
        ];
        const result = getResponsiveColumns(columns, 'lg');

        expect(result[0]).not.toHaveProperty('hideOnTablet');
      });

      it('strips mobileWidth from output columns', () => {
        const columns: ResponsiveColumn[] = [
          { field: 'test', headerName: 'Test', width: 200, mobileWidth: 100 },
        ];
        const result = getResponsiveColumns(columns, 'lg');

        expect(result[0]).not.toHaveProperty('mobileWidth');
      });
    });

    describe('edge cases', () => {
      it('handles empty column array', () => {
        const result = getResponsiveColumns([], 'xs');
        expect(result).toEqual([]);
      });

      it('handles all columns hidden', () => {
        const columns: ResponsiveColumn[] = [
          { field: 'test', headerName: 'Test', width: 200, hideOnMobile: true },
        ];
        const result = getResponsiveColumns(columns, 'xs');
        expect(result).toHaveLength(0);
      });

      it('preserves column order', () => {
        const columns: ResponsiveColumn[] = [
          { field: 'a', headerName: 'A', width: 100, priority: 'essential' },
          { field: 'b', headerName: 'B', width: 100, priority: 'essential' },
          { field: 'c', headerName: 'C', width: 100, priority: 'essential' },
        ];
        const result = getResponsiveColumns(columns, 'xs');

        expect(result.map(c => c.field)).toEqual(['a', 'b', 'c']);
      });

      it('preserves existing flex value on non-mobile', () => {
        const columns: ResponsiveColumn[] = [
          { field: 'test', headerName: 'Test', flex: 2 },
        ];
        const result = getResponsiveColumns(columns, 'lg');

        expect(result[0].flex).toBe(2);
      });

      it('uses flex 1 if no flex specified on mobile', () => {
        const columns: ResponsiveColumn[] = [
          { field: 'test', headerName: 'Test', width: 200, priority: 'essential' },
        ];
        const result = getResponsiveColumns(columns, 'xs');

        expect(result[0].flex).toBe(1);
      });
    });
  });

  describe('ColumnPriority type', () => {
    it('accepts valid priority values', () => {
      const priorities: ColumnPriority[] = ['essential', 'important', 'optional'];
      expect(priorities).toHaveLength(3);
    });
  });
});

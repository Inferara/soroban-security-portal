import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { EntityListCard, BaseListEntity } from '../EntityListCard';

const theme = createTheme();

// Mock navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock environment
vi.mock('../../../environments/environment', () => ({
  environment: {
    apiUrl: 'http://localhost:3000',
  },
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter>
    <ThemeProvider theme={theme}>{children}</ThemeProvider>
  </MemoryRouter>
);

interface TestEntity extends BaseListEntity {
  description?: string;
  count?: number;
}

const testItems: TestEntity[] = [
  { id: 1, name: 'Item One', description: 'First item' },
  { id: 2, name: 'Item Two', description: 'Second item' },
  { id: 3, name: 'Item Three', description: 'Third item' },
  { id: 4, name: 'Item Four', description: 'Fourth item' },
  { id: 5, name: 'Item Five', description: 'Fifth item' },
];

describe('EntityListCard', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  describe('rendering', () => {
    it('renders title', () => {
      render(
        <EntityListCard
          title="Test Items"
          items={testItems}
          entityType="protocol"
          navigationPattern="/protocol/{id}"
        />,
        { wrapper }
      );

      expect(screen.getByText('Test Items')).toBeInTheDocument();
    });

    it('renders title with count', () => {
      render(
        <EntityListCard
          title="Protocols"
          count={5}
          items={testItems}
          entityType="protocol"
          navigationPattern="/protocol/{id}"
        />,
        { wrapper }
      );

      expect(screen.getByText('Protocols (5)')).toBeInTheDocument();
    });

    it('renders header icon when provided', () => {
      render(
        <EntityListCard
          title="Test Items"
          headerIcon={<span data-testid="header-icon">Icon</span>}
          items={testItems}
          entityType="protocol"
          navigationPattern="/protocol/{id}"
        />,
        { wrapper }
      );

      expect(screen.getByTestId('header-icon')).toBeInTheDocument();
    });

    it('renders all items', () => {
      render(
        <EntityListCard
          title="Test Items"
          items={testItems}
          entityType="protocol"
          navigationPattern="/protocol/{id}"
        />,
        { wrapper }
      );

      expect(screen.getByText('Item One')).toBeInTheDocument();
      expect(screen.getByText('Item Two')).toBeInTheDocument();
      expect(screen.getByText('Item Three')).toBeInTheDocument();
      expect(screen.getByText('Item Four')).toBeInTheDocument();
      expect(screen.getByText('Item Five')).toBeInTheDocument();
    });

    it('limits items to maxItems', () => {
      render(
        <EntityListCard
          title="Test Items"
          items={testItems}
          entityType="protocol"
          navigationPattern="/protocol/{id}"
          maxItems={3}
        />,
        { wrapper }
      );

      expect(screen.getByText('Item One')).toBeInTheDocument();
      expect(screen.getByText('Item Two')).toBeInTheDocument();
      expect(screen.getByText('Item Three')).toBeInTheDocument();
      expect(screen.queryByText('Item Four')).not.toBeInTheDocument();
      expect(screen.queryByText('Item Five')).not.toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('shows default empty message when no items', () => {
      render(
        <EntityListCard
          title="Empty List"
          items={[]}
          entityType="protocol"
          navigationPattern="/protocol/{id}"
        />,
        { wrapper }
      );

      expect(screen.getByText('No items found')).toBeInTheDocument();
    });

    it('shows custom empty message', () => {
      render(
        <EntityListCard
          title="Empty List"
          items={[]}
          entityType="protocol"
          navigationPattern="/protocol/{id}"
          emptyMessage="No protocols available"
        />,
        { wrapper }
      );

      expect(screen.getByText('No protocols available')).toBeInTheDocument();
    });

    it('empty message has role="status"', () => {
      render(
        <EntityListCard
          title="Empty List"
          items={[]}
          entityType="protocol"
          navigationPattern="/protocol/{id}"
        />,
        { wrapper }
      );

      expect(screen.getByRole('status')).toHaveTextContent('No items found');
    });
  });

  describe('navigation', () => {
    it('navigates on item click', () => {
      render(
        <EntityListCard
          title="Test Items"
          items={testItems}
          entityType="protocol"
          navigationPattern="/protocol/{id}"
        />,
        { wrapper }
      );

      fireEvent.click(screen.getByText('Item One'));

      expect(mockNavigate).toHaveBeenCalledWith('/protocol/1');
    });

    it('replaces {id} in navigation pattern', () => {
      render(
        <EntityListCard
          title="Test Items"
          items={testItems}
          entityType="auditor"
          navigationPattern="/admin/auditor/{id}/edit"
        />,
        { wrapper }
      );

      fireEvent.click(screen.getByText('Item Three'));

      expect(mockNavigate).toHaveBeenCalledWith('/admin/auditor/3/edit');
    });

    it('navigates on Enter key press', () => {
      render(
        <EntityListCard
          title="Test Items"
          items={testItems}
          entityType="protocol"
          navigationPattern="/protocol/{id}"
        />,
        { wrapper }
      );

      const button = screen.getByRole('button', { name: /navigate to item one/i });
      fireEvent.keyDown(button, { key: 'Enter' });

      expect(mockNavigate).toHaveBeenCalledWith('/protocol/1');
    });

    it('navigates on Space key press', () => {
      render(
        <EntityListCard
          title="Test Items"
          items={testItems}
          entityType="protocol"
          navigationPattern="/protocol/{id}"
        />,
        { wrapper }
      );

      const button = screen.getByRole('button', { name: /navigate to item one/i });
      fireEvent.keyDown(button, { key: ' ' });

      expect(mockNavigate).toHaveBeenCalledWith('/protocol/1');
    });
  });

  describe('sorting', () => {
    it('applies sort function when provided', () => {
      const items: TestEntity[] = [
        { id: 3, name: 'Zebra' },
        { id: 1, name: 'Apple' },
        { id: 2, name: 'Banana' },
      ];

      render(
        <EntityListCard
          title="Sorted Items"
          items={items}
          entityType="protocol"
          navigationPattern="/protocol/{id}"
          sortFn={(a, b) => a.name.localeCompare(b.name)}
        />,
        { wrapper }
      );

      const listItems = screen.getAllByRole('button');
      expect(listItems[0]).toHaveTextContent('Apple');
      expect(listItems[1]).toHaveTextContent('Banana');
      expect(listItems[2]).toHaveTextContent('Zebra');
    });
  });

  describe('custom rendering', () => {
    it('uses custom renderPrimary', () => {
      render(
        <EntityListCard
          title="Test Items"
          items={testItems}
          entityType="protocol"
          navigationPattern="/protocol/{id}"
          renderPrimary={(item) => <span data-testid={`custom-${item.id}`}>Custom: {item.name}</span>}
        />,
        { wrapper }
      );

      expect(screen.getByTestId('custom-1')).toHaveTextContent('Custom: Item One');
    });

    it('uses custom renderSecondary', () => {
      render(
        <EntityListCard
          title="Test Items"
          items={testItems}
          entityType="protocol"
          navigationPattern="/protocol/{id}"
          renderSecondary={(item) => <span data-testid={`secondary-${item.id}`}>{item.description}</span>}
        />,
        { wrapper }
      );

      expect(screen.getByTestId('secondary-1')).toHaveTextContent('First item');
    });
  });

  describe('accessibility', () => {
    it('has accessible list structure', () => {
      render(
        <EntityListCard
          title="Accessible List"
          items={testItems}
          entityType="protocol"
          navigationPattern="/protocol/{id}"
        />,
        { wrapper }
      );

      expect(screen.getByRole('list')).toBeInTheDocument();
    });

    it('has aria-label for navigation buttons', () => {
      render(
        <EntityListCard
          title="Test Items"
          items={[{ id: 1, name: 'Test Item' }]}
          entityType="protocol"
          navigationPattern="/protocol/{id}"
        />,
        { wrapper }
      );

      expect(screen.getByRole('button', { name: 'Navigate to Test Item' })).toBeInTheDocument();
    });

    it('list has aria-labelledby pointing to title', () => {
      render(
        <EntityListCard
          title="My List Title"
          items={testItems}
          entityType="protocol"
          navigationPattern="/protocol/{id}"
        />,
        { wrapper }
      );

      const list = screen.getByRole('list');
      expect(list).toHaveAttribute('aria-labelledby', 'my-list-title-list-title');
    });
  });

  describe('avatar configuration', () => {
    it('uses default avatar size', () => {
      render(
        <EntityListCard
          title="Test Items"
          items={testItems}
          entityType="protocol"
          navigationPattern="/protocol/{id}"
        />,
        { wrapper }
      );

      // Avatars should be rendered (checking img elements)
      const images = document.querySelectorAll('img');
      expect(images.length).toBeGreaterThan(0);
    });

    it('accepts custom avatar size', () => {
      render(
        <EntityListCard
          title="Test Items"
          items={testItems}
          entityType="protocol"
          navigationPattern="/protocol/{id}"
          avatarSize="large"
        />,
        { wrapper }
      );

      // Component should render without errors
      expect(screen.getByText('Test Items')).toBeInTheDocument();
    });
  });
});

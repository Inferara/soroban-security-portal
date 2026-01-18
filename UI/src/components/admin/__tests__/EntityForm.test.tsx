import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { EntityForm, EntityFieldConfig } from '../EntityForm';

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

// Mock environment for avatar URL construction
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

interface TestFormValues {
  name: string;
  description: string;
  url: string;
  avatar: string | null;
  color: string;
  company: { id: number; name: string } | null;
}

describe('EntityForm', () => {
  const defaultValues: TestFormValues = {
    name: '',
    description: '',
    url: '',
    avatar: null,
    color: '#000000',
    company: null,
  };

  let onSubmit: ReturnType<typeof vi.fn>;
  let onFieldChange: ReturnType<typeof vi.fn>;
  let onCancel: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onSubmit = vi.fn();
    onFieldChange = vi.fn();
    onCancel = vi.fn();
    mockNavigate.mockClear();
  });

  describe('rendering', () => {
    it('renders text fields', () => {
      const fields: EntityFieldConfig[] = [
        { name: 'name', label: 'Name', type: 'text', required: true },
        { name: 'url', label: 'URL', type: 'text' },
      ];

      render(
        <EntityForm
          mode="add"
          entityType="auditor"
          fields={fields}
          values={defaultValues}
          onFieldChange={onFieldChange}
          onSubmit={onSubmit}
        />,
        { wrapper }
      );

      expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/url/i)).toBeInTheDocument();
    });

    it('renders textarea fields', () => {
      const fields: EntityFieldConfig[] = [
        { name: 'description', label: 'Description', type: 'textarea', minRows: 4 },
      ];

      render(
        <EntityForm
          mode="add"
          entityType="auditor"
          fields={fields}
          values={defaultValues}
          onFieldChange={onFieldChange}
          onSubmit={onSubmit}
        />,
        { wrapper }
      );

      const textarea = screen.getByLabelText(/description/i);
      expect(textarea).toBeInTheDocument();
      expect(textarea.tagName).toBe('TEXTAREA');
    });

    it('renders autocomplete fields', () => {
      const companies = [
        { id: 1, name: 'Company A' },
        { id: 2, name: 'Company B' },
      ];

      const fields: EntityFieldConfig[] = [
        {
          name: 'company',
          label: 'Company',
          type: 'autocomplete',
          options: companies,
          getOptionLabel: (option) => option.name,
        },
      ];

      render(
        <EntityForm
          mode="add"
          entityType="protocol"
          fields={fields}
          values={defaultValues}
          onFieldChange={onFieldChange}
          onSubmit={onSubmit}
        />,
        { wrapper }
      );

      expect(screen.getByLabelText(/company/i)).toBeInTheDocument();
    });

    it('renders color fields', () => {
      const fields: EntityFieldConfig[] = [
        { name: 'color', label: 'Color', type: 'color' },
      ];

      render(
        <EntityForm
          mode="add"
          entityType="auditor"
          fields={fields}
          values={defaultValues}
          onFieldChange={onFieldChange}
          onSubmit={onSubmit}
        />,
        { wrapper }
      );

      const colorInput = document.querySelector('input[type="color"]');
      expect(colorInput).toBeInTheDocument();
    });

    it('shows required indicator on required fields', () => {
      const fields: EntityFieldConfig[] = [
        { name: 'name', label: 'Name', type: 'text', required: true },
      ];

      render(
        <EntityForm
          mode="add"
          entityType="auditor"
          fields={fields}
          values={defaultValues}
          onFieldChange={onFieldChange}
          onSubmit={onSubmit}
        />,
        { wrapper }
      );

      const nameInput = screen.getByLabelText(/name/i);
      expect(nameInput).toHaveAttribute('required');
    });

    it('renders disabled text fields', () => {
      const fields: EntityFieldConfig[] = [
        { name: 'name', label: 'Name', type: 'text', disabled: true },
      ];

      render(
        <EntityForm
          mode="edit"
          entityType="auditor"
          fields={fields}
          values={{ ...defaultValues, name: 'Read Only' }}
          onFieldChange={onFieldChange}
          onSubmit={onSubmit}
        />,
        { wrapper }
      );

      const nameInput = screen.getByLabelText(/name/i);
      expect(nameInput).toBeDisabled();
    });
  });

  describe('button rendering', () => {
    it('renders submit and cancel buttons', () => {
      render(
        <EntityForm
          mode="add"
          entityType="auditor"
          fields={[]}
          values={defaultValues}
          onFieldChange={onFieldChange}
          onSubmit={onSubmit}
        />,
        { wrapper }
      );

      expect(screen.getByRole('button', { name: /create auditor/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    it('uses "Save" for edit mode', () => {
      render(
        <EntityForm
          mode="edit"
          entityType="protocol"
          entityId={1}
          fields={[]}
          values={defaultValues}
          onFieldChange={onFieldChange}
          onSubmit={onSubmit}
        />,
        { wrapper }
      );

      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    });

    it('uses custom submit button text', () => {
      render(
        <EntityForm
          mode="add"
          entityType="auditor"
          fields={[]}
          values={defaultValues}
          onFieldChange={onFieldChange}
          onSubmit={onSubmit}
          submitButtonText="Add New Entity"
        />,
        { wrapper }
      );

      expect(screen.getByRole('button', { name: /add new entity/i })).toBeInTheDocument();
    });

    it('uses custom cancel button text', () => {
      render(
        <EntityForm
          mode="add"
          entityType="auditor"
          fields={[]}
          values={defaultValues}
          onFieldChange={onFieldChange}
          onSubmit={onSubmit}
          cancelButtonText="Go Back"
        />,
        { wrapper }
      );

      expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('calls onSubmit when submit button is clicked', () => {
      render(
        <EntityForm
          mode="add"
          entityType="auditor"
          fields={[]}
          values={defaultValues}
          onFieldChange={onFieldChange}
          onSubmit={onSubmit}
        />,
        { wrapper }
      );

      fireEvent.click(screen.getByRole('button', { name: /create auditor/i }));

      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    it('calls onFieldChange when text field changes', () => {
      const fields: EntityFieldConfig[] = [
        { name: 'name', label: 'Name', type: 'text' },
      ];

      render(
        <EntityForm
          mode="add"
          entityType="auditor"
          fields={fields}
          values={defaultValues}
          onFieldChange={onFieldChange}
          onSubmit={onSubmit}
        />,
        { wrapper }
      );

      fireEvent.change(screen.getByLabelText(/name/i), {
        target: { value: 'New Name' },
      });

      expect(onFieldChange).toHaveBeenCalledWith('name', 'New Name');
    });

    it('calls onFieldChange when textarea changes', () => {
      const fields: EntityFieldConfig[] = [
        { name: 'description', label: 'Description', type: 'textarea' },
      ];

      render(
        <EntityForm
          mode="add"
          entityType="auditor"
          fields={fields}
          values={defaultValues}
          onFieldChange={onFieldChange}
          onSubmit={onSubmit}
        />,
        { wrapper }
      );

      fireEvent.change(screen.getByLabelText(/description/i), {
        target: { value: 'New description' },
      });

      expect(onFieldChange).toHaveBeenCalledWith('description', 'New description');
    });

    it('calls onCancel when cancel button is clicked', () => {
      render(
        <EntityForm
          mode="add"
          entityType="auditor"
          fields={[]}
          values={defaultValues}
          onFieldChange={onFieldChange}
          onSubmit={onSubmit}
          onCancel={onCancel}
        />,
        { wrapper }
      );

      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('navigates back when cancel is clicked without onCancel handler', () => {
      render(
        <EntityForm
          mode="add"
          entityType="auditor"
          fields={[]}
          values={defaultValues}
          onFieldChange={onFieldChange}
          onSubmit={onSubmit}
        />,
        { wrapper }
      );

      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

      expect(mockNavigate).toHaveBeenCalledWith(-1);
    });
  });

  describe('field values', () => {
    it('displays provided field values', () => {
      const fields: EntityFieldConfig[] = [
        { name: 'name', label: 'Name', type: 'text' },
        { name: 'url', label: 'URL', type: 'text' },
      ];

      const values = {
        ...defaultValues,
        name: 'Test Auditor',
        url: 'https://example.com',
      };

      render(
        <EntityForm
          mode="edit"
          entityType="auditor"
          entityId={1}
          fields={fields}
          values={values}
          onFieldChange={onFieldChange}
          onSubmit={onSubmit}
        />,
        { wrapper }
      );

      expect(screen.getByLabelText(/name/i)).toHaveValue('Test Auditor');
      expect(screen.getByLabelText(/url/i)).toHaveValue('https://example.com');
    });

    it('handles null/undefined field values', () => {
      const fields: EntityFieldConfig[] = [
        { name: 'name', label: 'Name', type: 'text' },
      ];

      const values = {
        ...defaultValues,
        name: undefined as unknown as string,
      };

      render(
        <EntityForm
          mode="add"
          entityType="auditor"
          fields={fields}
          values={values}
          onFieldChange={onFieldChange}
          onSubmit={onSubmit}
        />,
        { wrapper }
      );

      expect(screen.getByLabelText(/name/i)).toHaveValue('');
    });
  });

  describe('additional content', () => {
    it('renders additional content when provided', () => {
      render(
        <EntityForm
          mode="add"
          entityType="auditor"
          fields={[]}
          values={defaultValues}
          onFieldChange={onFieldChange}
          onSubmit={onSubmit}
          additionalContent={<div data-testid="extra">Extra Content</div>}
        />,
        { wrapper }
      );

      expect(screen.getByTestId('extra')).toBeInTheDocument();
      expect(screen.getByText('Extra Content')).toBeInTheDocument();
    });
  });

  describe('entity type handling', () => {
    it.each(['auditor', 'protocol', 'company', 'report', 'user'] as const)(
      'handles %s entity type',
      (entityType) => {
        render(
          <EntityForm
            mode="add"
            entityType={entityType}
            fields={[]}
            values={defaultValues}
            onFieldChange={onFieldChange}
            onSubmit={onSubmit}
          />,
          { wrapper }
        );

        const expectedText = `Create ${entityType.charAt(0).toUpperCase() + entityType.slice(1)}`;
        expect(screen.getByRole('button', { name: new RegExp(expectedText, 'i') })).toBeInTheDocument();
      }
    );
  });
});

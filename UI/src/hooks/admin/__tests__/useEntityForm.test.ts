import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useEntityForm, UseEntityFormConfig } from '../useEntityForm';

// Mock navigation
const mockNavigate = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useSearchParams: () => [mockSearchParams],
}));

// Mock Redux dispatch
const mockDispatch = vi.fn();
vi.mock('../../../app/hooks', () => ({
  useAppDispatch: () => mockDispatch,
}));

// Mock showError
const mockShowError = vi.fn();
vi.mock('../../../features/dialog-handler/dialog-handler', () => ({
  showError: (msg: string) => mockShowError(msg),
}));

interface TestEntity {
  id: number;
  name: string;
  description: string;
}

interface TestFormValues {
  name: string;
  description: string;
  image: string | null;
}

const defaultConfig: UseEntityFormConfig<TestEntity, TestFormValues> = {
  currentPageState: { pageName: 'Test Page', windowWidth: 1024 },
  mode: 'add',
  submitEntity: vi.fn().mockResolvedValue(true),
  initialValues: { name: '', description: '', image: null },
  successNavigatePath: '/test/success',
};

describe('useEntityForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();
    mockNavigate.mockClear();
    mockDispatch.mockClear();
    mockShowError.mockClear();
  });

  describe('initialization', () => {
    it('initializes with default values in add mode', () => {
      const { result } = renderHook(() => useEntityForm(defaultConfig));

      expect(result.current.values).toEqual({
        name: '',
        description: '',
        image: null,
      });
      expect(result.current.loading).toBe(false);
      expect(result.current.entity).toBeUndefined();
      expect(result.current.entityId).toBeNull();
    });

    it('sets current page on mount', () => {
      renderHook(() => useEntityForm(defaultConfig));

      expect(mockDispatch).toHaveBeenCalled();
    });

    it('starts loading in edit mode', async () => {
      mockSearchParams = new URLSearchParams('testId=123');

      const fetchEntity = vi.fn().mockResolvedValue(null);
      const config: UseEntityFormConfig<TestEntity, TestFormValues> = {
        ...defaultConfig,
        mode: 'edit',
        entityIdParam: 'testId',
        fetchEntity,
      };

      const { result } = renderHook(() => useEntityForm(config));

      // Should start in loading state
      expect(result.current.loading).toBe(true);

      // Wait for loading to complete
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });
  });

  describe('setFieldValue', () => {
    it('updates a single field', () => {
      const { result } = renderHook(() => useEntityForm(defaultConfig));

      act(() => {
        result.current.setFieldValue('name', 'Test Name');
      });

      expect(result.current.values.name).toBe('Test Name');
      expect(result.current.values.description).toBe('');
    });

    it('preserves other fields when updating one', () => {
      const { result } = renderHook(() => useEntityForm(defaultConfig));

      act(() => {
        result.current.setFieldValue('name', 'Test Name');
        result.current.setFieldValue('description', 'Test Description');
      });

      expect(result.current.values).toEqual({
        name: 'Test Name',
        description: 'Test Description',
        image: null,
      });
    });

    it('handles null values', () => {
      const { result } = renderHook(() => useEntityForm(defaultConfig));

      act(() => {
        result.current.setFieldValue('image', 'base64data');
      });
      expect(result.current.values.image).toBe('base64data');

      act(() => {
        result.current.setFieldValue('image', null);
      });
      expect(result.current.values.image).toBeNull();
    });
  });

  describe('setValues', () => {
    it('replaces all values at once', () => {
      const { result } = renderHook(() => useEntityForm(defaultConfig));

      act(() => {
        result.current.setValues({
          name: 'New Name',
          description: 'New Description',
          image: 'newimage',
        });
      });

      expect(result.current.values).toEqual({
        name: 'New Name',
        description: 'New Description',
        image: 'newimage',
      });
    });

    it('supports functional updates', () => {
      const { result } = renderHook(() => useEntityForm(defaultConfig));

      act(() => {
        result.current.setFieldValue('name', 'Initial');
      });

      act(() => {
        result.current.setValues((prev) => ({
          ...prev,
          description: 'Added later',
        }));
      });

      expect(result.current.values.name).toBe('Initial');
      expect(result.current.values.description).toBe('Added later');
    });
  });

  describe('entity loading (edit mode)', () => {
    it('loads entity by ID from URL params', async () => {
      mockSearchParams = new URLSearchParams('testId=42');

      const mockEntity: TestEntity = {
        id: 42,
        name: 'Loaded Entity',
        description: 'Loaded Description',
      };

      const fetchEntity = vi.fn().mockResolvedValue(mockEntity);
      const entityToFormValues = vi.fn((e: TestEntity) => ({
        name: e.name,
        description: e.description,
        image: null,
      }));

      const config: UseEntityFormConfig<TestEntity, TestFormValues> = {
        ...defaultConfig,
        mode: 'edit',
        entityIdParam: 'testId',
        fetchEntity,
        entityToFormValues,
      };

      const { result } = renderHook(() => useEntityForm(config));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(fetchEntity).toHaveBeenCalledWith(42);
      expect(result.current.entity).toEqual(mockEntity);
      expect(result.current.entityId).toBe(42);
      expect(result.current.values.name).toBe('Loaded Entity');
    });

    it('handles fetch failure', async () => {
      mockSearchParams = new URLSearchParams('testId=999');

      const fetchEntity = vi.fn().mockRejectedValue(new Error('Not found'));

      const config: UseEntityFormConfig<TestEntity, TestFormValues> = {
        ...defaultConfig,
        mode: 'edit',
        entityIdParam: 'testId',
        fetchEntity,
      };

      const { result } = renderHook(() => useEntityForm(config));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.entity).toBeNull();
    });

    it('sets entity to null when no ID in params', async () => {
      const config: UseEntityFormConfig<TestEntity, TestFormValues> = {
        ...defaultConfig,
        mode: 'edit',
        entityIdParam: 'testId',
        fetchEntity: vi.fn(),
      };

      const { result } = renderHook(() => useEntityForm(config));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.entity).toBeNull();
      expect(result.current.entityId).toBeNull();
    });
  });

  describe('submit', () => {
    it('calls submitEntity and navigates on success', async () => {
      const submitEntity = vi.fn().mockResolvedValue(true);

      const config: UseEntityFormConfig<TestEntity, TestFormValues> = {
        ...defaultConfig,
        submitEntity,
      };

      const { result } = renderHook(() => useEntityForm(config));

      act(() => {
        result.current.setFieldValue('name', 'Test');
      });

      await act(async () => {
        await result.current.submit();
      });

      expect(submitEntity).toHaveBeenCalledWith({
        name: 'Test',
        description: '',
        image: null,
      });
      expect(mockNavigate).toHaveBeenCalledWith('/test/success');
    });

    it('shows error on submit failure', async () => {
      const submitEntity = vi.fn().mockResolvedValue(false);

      const config: UseEntityFormConfig<TestEntity, TestFormValues> = {
        ...defaultConfig,
        submitEntity,
        submitErrorMessage: 'Custom submit error',
      };

      const { result } = renderHook(() => useEntityForm(config));

      await act(async () => {
        await result.current.submit();
      });

      expect(mockShowError).toHaveBeenCalledWith('Custom submit error');
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('uses default error message when not provided', async () => {
      const submitEntity = vi.fn().mockResolvedValue(false);

      const config: UseEntityFormConfig<TestEntity, TestFormValues> = {
        ...defaultConfig,
        submitEntity,
      };

      const { result } = renderHook(() => useEntityForm(config));

      await act(async () => {
        await result.current.submit();
      });

      expect(mockShowError).toHaveBeenCalledWith('Operation failed.');
    });
  });

  describe('validation', () => {
    it('runs validation before submit', async () => {
      const submitEntity = vi.fn().mockResolvedValue(true);
      const validate = vi.fn().mockReturnValue(true);

      const config: UseEntityFormConfig<TestEntity, TestFormValues> = {
        ...defaultConfig,
        submitEntity,
        validate,
      };

      const { result } = renderHook(() => useEntityForm(config));

      await act(async () => {
        await result.current.submit();
      });

      expect(validate).toHaveBeenCalled();
      expect(submitEntity).toHaveBeenCalled();
    });

    it('shows validation error when validation fails', async () => {
      const submitEntity = vi.fn().mockResolvedValue(true);
      const validate = vi.fn().mockReturnValue(false);

      const config: UseEntityFormConfig<TestEntity, TestFormValues> = {
        ...defaultConfig,
        submitEntity,
        validate,
        validationErrorMessage: 'Custom validation error',
      };

      const { result } = renderHook(() => useEntityForm(config));

      await act(async () => {
        await result.current.submit();
      });

      expect(validate).toHaveBeenCalled();
      expect(mockShowError).toHaveBeenCalledWith('Custom validation error');
      expect(submitEntity).not.toHaveBeenCalled();
    });

    it('does not submit when validation fails', async () => {
      const submitEntity = vi.fn();
      const validate = vi.fn().mockReturnValue(false);

      const config: UseEntityFormConfig<TestEntity, TestFormValues> = {
        ...defaultConfig,
        submitEntity,
        validate,
      };

      const { result } = renderHook(() => useEntityForm(config));

      await act(async () => {
        await result.current.submit();
      });

      expect(submitEntity).not.toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  describe('additional loaders', () => {
    it('loads additional data on mount', async () => {
      const mockCompanies = [{ id: 1, name: 'Company A' }];
      const mockTags = [{ id: 1, name: 'Tag A' }];

      const config: UseEntityFormConfig<TestEntity, TestFormValues> = {
        ...defaultConfig,
        additionalLoaders: [
          { key: 'companies', loader: vi.fn().mockResolvedValue(mockCompanies) },
          { key: 'tags', loader: vi.fn().mockResolvedValue(mockTags) },
        ],
      };

      const { result } = renderHook(() => useEntityForm(config));

      await waitFor(() => {
        expect(result.current.additionalData.companies).toEqual(mockCompanies);
        expect(result.current.additionalData.tags).toEqual(mockTags);
      });
    });

    it('handles additional loader failure gracefully', async () => {
      const config: UseEntityFormConfig<TestEntity, TestFormValues> = {
        ...defaultConfig,
        additionalLoaders: [
          { key: 'companies', loader: vi.fn().mockRejectedValue(new Error('Failed')) },
        ],
      };

      const { result } = renderHook(() => useEntityForm(config));

      await waitFor(() => {
        expect(result.current.additionalData.companies).toEqual([]);
      });
    });
  });

  describe('entityId parsing', () => {
    it('parses valid integer ID from URL', async () => {
      mockSearchParams = new URLSearchParams('testId=123');

      const fetchEntity = vi.fn().mockResolvedValue(null);
      const config: UseEntityFormConfig<TestEntity, TestFormValues> = {
        ...defaultConfig,
        mode: 'edit',
        entityIdParam: 'testId',
        fetchEntity,
      };

      const { result } = renderHook(() => useEntityForm(config));

      expect(result.current.entityId).toBe(123);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it('returns null for non-numeric ID', async () => {
      mockSearchParams = new URLSearchParams('testId=abc');

      const fetchEntity = vi.fn().mockResolvedValue(null);
      const config: UseEntityFormConfig<TestEntity, TestFormValues> = {
        ...defaultConfig,
        mode: 'edit',
        entityIdParam: 'testId',
        fetchEntity,
      };

      const { result } = renderHook(() => useEntityForm(config));

      expect(result.current.entityId).toBeNull();

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it('returns null when entityIdParam not configured', () => {
      mockSearchParams = new URLSearchParams('testId=123');

      const { result } = renderHook(() => useEntityForm(defaultConfig));

      expect(result.current.entityId).toBeNull();
    });
  });
});

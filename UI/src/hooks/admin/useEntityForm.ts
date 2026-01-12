import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAppDispatch } from '../../app/hooks';
import { CurrentPageState, setCurrentPage } from '../../features/pages/admin/admin-main-window/current-page-slice';
import { showError } from '../../features/dialog-handler/dialog-handler';

/**
 * Configuration for useEntityForm hook
 */
export interface UseEntityFormConfig<TEntity, TFormValues> {
  /** Current page state for navigation tracking */
  currentPageState: CurrentPageState;
  /** Form mode - 'add' or 'edit' */
  mode: 'add' | 'edit';
  /** URL parameter name for entity ID (e.g., 'auditorId', 'protocolId') */
  entityIdParam?: string;
  /** Function to fetch entity by ID (for edit mode) */
  fetchEntity?: (id: number) => Promise<TEntity | null>;
  /** Function to submit the form data */
  submitEntity: (data: TFormValues) => Promise<boolean>;
  /** Initial form values for add mode */
  initialValues: TFormValues;
  /** Function to convert entity to form values (for edit mode) */
  entityToFormValues?: (entity: TEntity) => TFormValues;
  /** Path to navigate to on successful submit */
  successNavigatePath: string;
  /** Error message for validation failure */
  validationErrorMessage?: string;
  /** Error message for submit failure */
  submitErrorMessage?: string;
  /** Function to validate form before submit (returns true if valid) */
  validate?: (values: TFormValues) => boolean;
  /** Additional data loaders (e.g., for autocomplete options) */
  additionalLoaders?: Array<{
    key: string;
    loader: () => Promise<unknown[]>;
  }>;
}

/**
 * Return type for useEntityForm hook
 */
export interface UseEntityFormResult<TEntity, TFormValues> {
  /** Current form values */
  values: TFormValues;
  /** Update a single form field */
  setFieldValue: <K extends keyof TFormValues>(field: K, value: TFormValues[K]) => void;
  /** Set all form values at once */
  setValues: React.Dispatch<React.SetStateAction<TFormValues>>;
  /** Submit the form */
  submit: () => Promise<void>;
  /** The loaded entity (for edit mode) */
  entity: TEntity | null | undefined;
  /** Entity ID from URL params (for edit mode) */
  entityId: number | null;
  /** Whether the entity is loading (for edit mode) */
  loading: boolean;
  /** Additional loaded data (from additionalLoaders) */
  additionalData: Record<string, unknown[]>;
}

/**
 * useEntityForm - A generic hook for admin add/edit forms.
 *
 * This hook eliminates code duplication across admin form hooks by providing:
 * - Current page state management
 * - Form value state with field-level updates
 * - Entity loading for edit mode (from URL params)
 * - Additional data loading (e.g., for autocomplete options)
 * - Form submission with validation
 * - Navigation on success
 *
 * @example Add mode:
 * ```tsx
 * const { values, setFieldValue, submit } = useEntityForm({
 *   currentPageState: { pageName: 'Add Auditor', ... },
 *   mode: 'add',
 *   submitEntity: addAuditorCall,
 *   initialValues: { name: '', url: '', description: '', image: null },
 *   successNavigatePath: '/admin/auditors',
 *   validate: (v) => v.name !== '' && v.url !== '',
 *   validationErrorMessage: 'Name and URL are required.',
 *   submitErrorMessage: 'Auditor creation failed.',
 * });
 * ```
 *
 * @example Edit mode with additional data:
 * ```tsx
 * const { values, setFieldValue, submit, entity, additionalData } = useEntityForm({
 *   currentPageState: { pageName: 'Edit Protocol', ... },
 *   mode: 'edit',
 *   entityIdParam: 'protocolId',
 *   fetchEntity: getProtocolByIdCall,
 *   submitEntity: editProtocolCall,
 *   initialValues: { name: '', url: '', company: null, description: '', image: null },
 *   entityToFormValues: (p) => ({ name: p.name, url: p.url, ... }),
 *   successNavigatePath: '/admin/protocols',
 *   additionalLoaders: [
 *     { key: 'companies', loader: getCompanyListDataCall }
 *   ],
 * });
 * const companies = additionalData.companies as CompanyItem[];
 * ```
 */
export function useEntityForm<TEntity, TFormValues>(
  config: UseEntityFormConfig<TEntity, TFormValues>
): UseEntityFormResult<TEntity, TFormValues> {
  const {
    currentPageState,
    mode,
    entityIdParam,
    fetchEntity,
    submitEntity,
    initialValues,
    entityToFormValues,
    successNavigatePath,
    validationErrorMessage = 'Validation failed.',
    submitErrorMessage = 'Operation failed.',
    validate,
    additionalLoaders,
  } = config;

  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [values, setValues] = useState<TFormValues>(initialValues);
  const [entity, setEntity] = useState<TEntity | null | undefined>(undefined);
  const [loading, setLoading] = useState(mode === 'edit');
  const [additionalData, setAdditionalData] = useState<Record<string, unknown[]>>({});

  // Parse entity ID from URL params
  const entityId = entityIdParam
    ? parseInt(searchParams.get(entityIdParam) ?? '', 10) || null
    : null;

  // Set field value helper
  const setFieldValue = useCallback(<K extends keyof TFormValues>(field: K, value: TFormValues[K]) => {
    setValues(prev => ({ ...prev, [field]: value }));
  }, []);

  // Load entity for edit mode
  useEffect(() => {
    if (mode === 'edit' && fetchEntity && entityId) {
      setLoading(true);
      fetchEntity(entityId)
        .then(result => {
          setEntity(result);
          if (result && entityToFormValues) {
            setValues(entityToFormValues(result));
          }
        })
        .catch(() => {
          setEntity(null);
        })
        .finally(() => {
          setLoading(false);
        });
    } else if (mode === 'edit') {
      setEntity(null);
      setLoading(false);
    }
  }, [mode, entityId, fetchEntity, entityToFormValues]);

  // Load additional data
  useEffect(() => {
    if (additionalLoaders) {
      additionalLoaders.forEach(({ key, loader }) => {
        loader()
          .then(data => {
            setAdditionalData(prev => ({ ...prev, [key]: data }));
          })
          .catch(() => {
            setAdditionalData(prev => ({ ...prev, [key]: [] }));
          });
      });
    }
  }, [additionalLoaders]);

  // Set current page
  useEffect(() => {
    dispatch(setCurrentPage(currentPageState));
  }, [dispatch, currentPageState]);

  // Submit handler
  const submit = useCallback(async () => {
    // Run validation if provided
    if (validate && !validate(values)) {
      showError(validationErrorMessage);
      return;
    }

    const success = await submitEntity(values);
    if (success) {
      navigate(successNavigatePath);
    } else {
      showError(submitErrorMessage);
    }
  }, [values, validate, validationErrorMessage, submitEntity, navigate, successNavigatePath, submitErrorMessage]);

  return {
    values,
    setFieldValue,
    setValues,
    submit,
    entity,
    entityId,
    loading,
    additionalData,
  };
}

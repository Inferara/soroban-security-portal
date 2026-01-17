import { ReactNode, useMemo } from 'react';
import {
  Box,
  Button,
  FormHelperText,
  Grid,
  Stack,
  TextField,
  Autocomplete,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { formControlWidth, editAreaStyle } from '../../theme';
import { AvatarUpload } from '../AvatarUpload';
import { getEntityAvatarUrl, EntityType } from '../EntityAvatar';

/**
 * Supported field types for EntityForm
 */
export type EntityFieldType = 'text' | 'textarea' | 'autocomplete' | 'avatar' | 'color';

/**
 * Base field configuration
 */
interface BaseFieldConfig {
  /** Unique field name/key */
  name: string;
  /** Display label */
  label: string;
  /** Field type */
  type: EntityFieldType;
  /** Whether field is required */
  required?: boolean;
}

/**
 * Text field configuration
 */
export interface TextFieldConfig extends BaseFieldConfig {
  type: 'text';
  /** Whether the field is disabled */
  disabled?: boolean;
}

/**
 * Textarea field configuration
 */
export interface TextareaFieldConfig extends BaseFieldConfig {
  type: 'textarea';
  /** Minimum number of rows */
  minRows?: number;
  /** Maximum number of rows */
  maxRows?: number;
}

/**
 * Autocomplete field configuration
 */
export interface AutocompleteFieldConfig extends BaseFieldConfig {
  type: 'autocomplete';
  /** Options for the autocomplete */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options: any[];
  /** Function to get the display label from an option */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getOptionLabel: (option: any) => string;
}

/**
 * Avatar field configuration
 */
export interface AvatarFieldConfig extends BaseFieldConfig {
  type: 'avatar';
  /** Default placeholder character when no name is provided */
  defaultPlaceholder?: string;
  /** Field name to derive placeholder from (uses first character) */
  placeholderFromField?: string;
}

/**
 * Color picker field configuration
 */
export interface ColorFieldConfig extends BaseFieldConfig {
  type: 'color';
  /** Whether the field is disabled */
  disabled?: boolean;
}

/**
 * Union type for all field configurations
 */
export type EntityFieldConfig =
  | TextFieldConfig
  | TextareaFieldConfig
  | AutocompleteFieldConfig
  | AvatarFieldConfig
  | ColorFieldConfig;

// EntityType is re-exported from EntityAvatar for convenience
export type { EntityType };

/**
 * Props for EntityForm component
 */
export interface EntityFormProps<T> {
  /** Form mode - 'add' or 'edit' */
  mode: 'add' | 'edit';
  /** Entity type for avatar URL generation */
  entityType: EntityType;
  /** Entity ID (required for edit mode to load existing avatar) */
  entityId?: number;
  /** Field configurations */
  fields: EntityFieldConfig[];
  /** Current form values */
  values: T;
  /** Callback when a field value changes */
  onFieldChange: (field: keyof T, value: T[keyof T]) => void;
  /** Callback when form is submitted */
  onSubmit: () => void;
  /** Callback when cancel is clicked (defaults to history.back()) */
  onCancel?: () => void;
  /** Submit button text (defaults based on mode) */
  submitButtonText?: string;
  /** Cancel button text (defaults to "Cancel") */
  cancelButtonText?: string;
  /** Additional content to render after the fields */
  additionalContent?: ReactNode;
}

/**
 * EntityForm - A reusable form component for admin add/edit pages.
 *
 * This component eliminates code duplication across admin entity forms by providing:
 * - Standardized layout with MUI Grid
 * - Avatar upload with proper URL handling for edit mode
 * - Text fields, textarea fields, and autocomplete fields
 * - Consistent styling using defaultUiSettings
 * - Submit/cancel button pair
 *
 * @example Basic add form:
 * ```tsx
 * <EntityForm
 *   mode="add"
 *   entityType="auditor"
 *   fields={[
 *     { name: 'avatar', type: 'avatar', label: 'Avatar', placeholderFromField: 'name', defaultPlaceholder: 'A' },
 *     { name: 'name', type: 'text', label: 'Name', required: true },
 *     { name: 'url', type: 'text', label: 'URL', required: true },
 *     { name: 'description', type: 'textarea', label: 'Description', minRows: 4, maxRows: 10 },
 *   ]}
 *   values={formValues}
 *   onFieldChange={(field, value) => setFormValues(prev => ({ ...prev, [field]: value }))}
 *   onSubmit={handleSubmit}
 * />
 * ```
 *
 * @example Edit form with autocomplete:
 * ```tsx
 * <EntityForm
 *   mode="edit"
 *   entityType="protocol"
 *   entityId={protocol?.id}
 *   fields={[
 *     { name: 'image', type: 'avatar', label: 'Avatar', placeholderFromField: 'name', defaultPlaceholder: 'P' },
 *     { name: 'name', type: 'text', label: 'Name', required: true },
 *     { name: 'company', type: 'autocomplete', label: 'Company', options: companies, getOptionLabel: (c) => c.name },
 *     { name: 'url', type: 'text', label: 'URL', required: true },
 *     { name: 'description', type: 'textarea', label: 'Description', minRows: 4, maxRows: 10 },
 *   ]}
 *   values={formValues}
 *   onFieldChange={handleFieldChange}
 *   onSubmit={handleSubmit}
 * />
 * ```
 */
export function EntityForm<T>({
  mode,
  entityType,
  entityId,
  fields,
  values,
  onFieldChange,
  onSubmit,
  onCancel,
  submitButtonText,
  cancelButtonText = 'Cancel',
  additionalContent,
}: EntityFormProps<T>) {
  const navigate = useNavigate();

  // Generate existing image URL for edit mode
  const existingImageUrl = useMemo(() => {
    if (mode !== 'edit' || !entityId) return null;
    return getEntityAvatarUrl(entityType, entityId, Date.now());
  }, [mode, entityType, entityId]);

  const defaultSubmitText = mode === 'add' ? `Create ${entityType.charAt(0).toUpperCase() + entityType.slice(1)}` : 'Save';
  const finalSubmitText = submitButtonText ?? defaultSubmitText;

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      navigate(-1);
    }
  };

  // Type-safe field value getter
  const getFieldValue = (fieldName: string): unknown => {
    return (values as Record<string, unknown>)[fieldName];
  };

  const renderField = (field: EntityFieldConfig) => {
    const gridSx = { textAlign: 'center', alignContent: 'center' };
    const avatarGridSx = { display: 'flex', flexDirection: 'column', alignItems: 'center' };

    switch (field.type) {
      case 'avatar': {
        const avatarField = field as AvatarFieldConfig;
        const placeholderSourceValue = avatarField.placeholderFromField
          ? String(getFieldValue(avatarField.placeholderFromField) ?? '')
          : '';
        const placeholderChar = placeholderSourceValue.charAt(0).toUpperCase() || avatarField.defaultPlaceholder || '?';

        return (
          <Grid key={field.name} size={12} sx={avatarGridSx}>
            <AvatarUpload
              key={mode === 'edit' ? `${entityType}-avatar-${entityId ?? 'new'}` : undefined}
              placeholder={placeholderChar}
              setImageCallback={(img) => onFieldChange(field.name as keyof T, img as T[keyof T])}
              initialImage={getFieldValue(field.name) as string | null}
              initialImageUrl={mode === 'edit' ? existingImageUrl : undefined}
            />
            <FormHelperText sx={{ mt: 1, textAlign: 'center' }}>
              PNG, JPG, or GIF. Max 100KB.
            </FormHelperText>
          </Grid>
        );
      }

      case 'text': {
        const textField = field as TextFieldConfig;
        return (
          <Grid key={field.name} size={12} sx={gridSx}>
            <TextField
              sx={formControlWidth}
              required={field.required}
              disabled={textField.disabled}
              id={field.name}
              label={field.label}
              value={getFieldValue(field.name) ?? ''}
              onChange={(e) => onFieldChange(field.name as keyof T, e.target.value as T[keyof T])}
              type="text"
            />
          </Grid>
        );
      }

      case 'textarea': {
        const textareaField = field as TextareaFieldConfig;
        return (
          <Grid key={field.name} size={12} sx={gridSx}>
            <TextField
              sx={formControlWidth}
              required={field.required}
              id={field.name}
              label={field.label}
              value={getFieldValue(field.name) ?? ''}
              onChange={(e) => onFieldChange(field.name as keyof T, e.target.value as T[keyof T])}
              type="text"
              multiline
              minRows={textareaField.minRows ?? 4}
              maxRows={textareaField.maxRows ?? 10}
            />
          </Grid>
        );
      }

      case 'autocomplete': {
        const autocompleteField = field as AutocompleteFieldConfig;
        return (
          <Grid key={field.name} size={12} sx={gridSx}>
            <Autocomplete
              options={autocompleteField.options}
              value={getFieldValue(field.name) ?? null}
              onChange={(_, newValue) => onFieldChange(field.name as keyof T, newValue as T[keyof T])}
              getOptionLabel={(option) => autocompleteField.getOptionLabel(option)}
              isOptionEqualToValue={(option, value) => option?.id === value?.id}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={field.label}
                  required={field.required}
                  sx={formControlWidth}
                />
              )}
            />
          </Grid>
        );
      }

      case 'color': {
        const colorField = field as ColorFieldConfig;
        return (
          <Grid key={field.name} size={12} sx={gridSx}>
            <TextField
              sx={formControlWidth}
              required={field.required}
              disabled={colorField.disabled}
              id={field.name}
              label={field.label}
              value={getFieldValue(field.name) ?? '#000000'}
              onChange={(e) => onFieldChange(field.name as keyof T, e.target.value as T[keyof T])}
              type="color"
              slotProps={{
                input: {
                  style: { height: '56px' }
                }
              }}
            />
          </Grid>
        );
      }

      default:
        return null;
    }
  };

  return (
    <Box sx={editAreaStyle}>
      <Grid container spacing={2}>
        {fields.map(renderField)}
      </Grid>
      <Stack direction="row" spacing={2} justifyContent="center" sx={{ marginTop: 2 }}>
        <Button type="button" variant="contained" onClick={onSubmit}>{finalSubmitText}</Button>
        <Button type="button" variant="outlined" onClick={handleCancel}>{cancelButtonText}</Button>
      </Stack>
      {additionalContent}
    </Box>
  );
}

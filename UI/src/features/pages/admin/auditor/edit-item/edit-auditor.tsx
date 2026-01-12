import { FC, useCallback, useMemo, useRef, useEffect } from 'react';
import { editAuditorCall, getAuditorByIdCall } from '../../../../../api/soroban-security-portal/soroban-security-portal-api';
import { AuditorItem } from '../../../../../api/soroban-security-portal/models/auditor';
import { CurrentPageState } from '../../admin-main-window/current-page-slice';
import { EntityForm, EntityFieldConfig } from '../../../../../components/admin';
import { useEntityForm } from '../../../../../hooks/admin';

interface AuditorFormValues {
  name: string;
  url: string;
  description: string;
  image: string | null;
}

export const EditAuditor: FC = () => {
  const currentPageState: CurrentPageState = useMemo(() => ({
    pageName: 'Edit Auditor',
    pageCode: 'editAuditor',
    pageUrl: window.location.pathname,
    routePath: 'admin/auditors/edit',
  }), []);

  const entityToFormValues = useCallback((auditor: AuditorItem): AuditorFormValues => ({
    name: auditor.name ?? '',
    url: auditor.url ?? '',
    description: auditor.description ?? '',
    image: null, // Don't use base64 from API, use URL instead
  }), []);

  // Use a ref to store the entity for the submit callback
  const entityRef = useRef<AuditorItem | null>(null);

  const submitAuditor = useCallback(async (vals: AuditorFormValues): Promise<boolean> => {
    const currentEntity = entityRef.current;
    if (!currentEntity) return false;
    const auditorItem: AuditorItem = {
      id: currentEntity.id,
      name: vals.name,
      url: vals.url,
      description: vals.description,
      image: vals.image ?? undefined,
      date: currentEntity.date,
      createdBy: currentEntity.createdBy,
    };
    return await editAuditorCall(auditorItem);
  }, []);

  const { values, setFieldValue, submit, entity, entityId } = useEntityForm<AuditorItem, AuditorFormValues>({
    currentPageState,
    mode: 'edit',
    entityIdParam: 'auditorId',
    fetchEntity: getAuditorByIdCall,
    submitEntity: submitAuditor,
    initialValues: { name: '', url: '', description: '', image: null },
    entityToFormValues,
    successNavigatePath: '/admin/auditors',
    validate: (v) => v.name !== '' && v.url !== '',
    validationErrorMessage: 'Name and URL are required.',
    submitErrorMessage: 'Auditor updating failed.',
  });

  // Keep entityRef in sync with entity from hook
  useEffect(() => {
    entityRef.current = entity ?? null;
  }, [entity]);

  const fields: EntityFieldConfig[] = useMemo(() => [
    { name: 'image', type: 'avatar', label: 'Avatar', placeholderFromField: 'name', defaultPlaceholder: 'A' },
    { name: 'name', type: 'text', label: 'Name', required: true },
    { name: 'url', type: 'text', label: 'URL', required: true },
    { name: 'description', type: 'textarea', label: 'Description', minRows: 4, maxRows: 10 },
  ], []);

  return (
    <EntityForm
      mode="edit"
      entityType="auditor"
      entityId={entityId ?? undefined}
      fields={fields}
      values={values}
      onFieldChange={setFieldValue}
      onSubmit={submit}
      submitButtonText="Save"
    />
  );
};

import { FC, useCallback, useMemo, useRef, useEffect } from 'react';
import { editCompanyCall, getCompanyByIdCall } from '../../../../../api/soroban-security-portal/soroban-security-portal-api';
import { CompanyItem } from '../../../../../api/soroban-security-portal/models/company';
import { CurrentPageState } from '../../admin-main-window/current-page-slice';
import { EntityForm, EntityFieldConfig } from '../../../../../components/admin';
import { useEntityForm } from '../../../../../hooks/admin';

interface CompanyFormValues {
  name: string;
  url: string;
  description: string;
  image: string | null;
}

export const EditCompany: FC = () => {
  const currentPageState: CurrentPageState = useMemo(() => ({
    pageName: 'Edit Company',
    pageCode: 'editCompany',
    pageUrl: window.location.pathname,
    routePath: 'admin/companies/edit',
  }), []);

  const entityToFormValues = useCallback((company: CompanyItem): CompanyFormValues => ({
    name: company.name ?? '',
    url: company.url ?? '',
    description: company.description ?? '',
    image: null, // Don't use base64 from API, use URL instead
  }), []);

  // Use a ref to store the entity for the submit callback
  const entityRef = useRef<CompanyItem | null>(null);

  const submitCompany = useCallback(async (vals: CompanyFormValues): Promise<boolean> => {
    const currentEntity = entityRef.current;
    if (!currentEntity) return false;
    const companyItem: CompanyItem = {
      id: currentEntity.id,
      name: vals.name,
      url: vals.url,
      description: vals.description,
      image: vals.image ?? undefined,
      date: currentEntity.date,
      createdBy: currentEntity.createdBy,
    };
    return await editCompanyCall(companyItem);
  }, []);

  const { values, setFieldValue, submit, entity, entityId } = useEntityForm<CompanyItem, CompanyFormValues>({
    currentPageState,
    mode: 'edit',
    entityIdParam: 'companyId',
    fetchEntity: getCompanyByIdCall,
    submitEntity: submitCompany,
    initialValues: { name: '', url: '', description: '', image: null },
    entityToFormValues,
    successNavigatePath: '/admin/companies',
    validate: (v) => v.name !== '' && v.url !== '',
    validationErrorMessage: 'Name and URL are required.',
    submitErrorMessage: 'Company updating failed.',
  });

  // Keep entityRef in sync with entity from hook
  useEffect(() => {
    entityRef.current = entity ?? null;
  }, [entity]);

  const fields: EntityFieldConfig[] = useMemo(() => [
    { name: 'image', type: 'avatar', label: 'Avatar', placeholderFromField: 'name', defaultPlaceholder: 'C' },
    { name: 'name', type: 'text', label: 'Name', required: true },
    { name: 'url', type: 'text', label: 'URL', required: true },
    { name: 'description', type: 'textarea', label: 'Description', minRows: 4, maxRows: 10 },
  ], []);

  return (
    <EntityForm
      mode="edit"
      entityType="company"
      entityId={entityId ?? undefined}
      fields={fields}
      values={values}
      onFieldChange={setFieldValue}
      onSubmit={submit}
      submitButtonText="Save"
    />
  );
};

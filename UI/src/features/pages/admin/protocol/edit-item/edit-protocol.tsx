import { FC, useEffect, useMemo, useCallback, useRef } from 'react';
import { editProtocolCall, getCompanyListDataCall, getProtocolByIdCall } from '../../../../../api/soroban-security-portal/soroban-security-portal-api';
import { ProtocolItem } from '../../../../../api/soroban-security-portal/models/protocol';
import { CompanyItem } from '../../../../../api/soroban-security-portal/models/company';
import { CurrentPageState } from '../../admin-main-window/current-page-slice';
import { EntityForm, EntityFieldConfig } from '../../../../../components/admin';
import { useEntityForm } from '../../../../../hooks/admin';

interface ProtocolFormValues {
  name: string;
  url: string;
  company: CompanyItem | null;
  description: string;
  image: string | null;
}

export const EditProtocol: FC = () => {
  const currentPageState: CurrentPageState = useMemo(() => ({
    pageName: 'Edit Protocol',
    pageCode: 'editProtocol',
    pageUrl: window.location.pathname,
    routePath: 'admin/protocols/edit',
  }), []);

  const additionalLoaders = useMemo(() => [
    { key: 'companies', loader: getCompanyListDataCall }
  ], []);

  // Use a ref to store the entity for the submit callback
  const entityRef = useRef<ProtocolItem | null>(null);

  const submitProtocol = useCallback(async (vals: ProtocolFormValues): Promise<boolean> => {
    const currentEntity = entityRef.current;
    if (!currentEntity) return false;
    const protocolItem: ProtocolItem = {
      id: currentEntity.id,
      name: vals.name,
      url: vals.url,
      companyId: vals.company?.id ?? 0,
      description: vals.description,
      image: vals.image ?? undefined,
      date: currentEntity.date,
      createdBy: currentEntity.createdBy,
    };
    return await editProtocolCall(protocolItem);
  }, []);

  const { values, setFieldValue, setValues, submit, entity, entityId, additionalData } = useEntityForm<ProtocolItem, ProtocolFormValues>({
    currentPageState,
    mode: 'edit',
    entityIdParam: 'protocolId',
    fetchEntity: getProtocolByIdCall,
    submitEntity: submitProtocol,
    initialValues: { name: '', url: '', company: null, description: '', image: null },
    successNavigatePath: '/admin/protocols',
    validate: (v) => v.name !== '' && v.url !== '',
    validationErrorMessage: 'Name and URL are required.',
    submitErrorMessage: 'Protocol updating failed.',
    additionalLoaders,
  });

  const companies = (additionalData.companies ?? []) as CompanyItem[];

  // Keep entityRef in sync with entity from hook
  useEffect(() => {
    entityRef.current = entity ?? null;
  }, [entity]);

  // Update form values when entity loads (need to find company from list)
  // This useEffect is intentionally here because it needs to correlate
  // entity.companyId with the loaded companies list
  useEffect(() => {
    if (entity) {
      setValues({
        name: entity.name ?? '',
        url: entity.url ?? '',
        company: companies.find(c => c.id === entity.companyId) ?? null,
        description: entity.description ?? '',
        image: null, // Don't use base64 from API, use URL instead
      });
    }
  }, [entity, companies, setValues]);

  const fields: EntityFieldConfig[] = useMemo(() => [
    { name: 'image', type: 'avatar', label: 'Avatar', placeholderFromField: 'name', defaultPlaceholder: 'P' },
    { name: 'name', type: 'text', label: 'Name', required: true },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { name: 'company', type: 'autocomplete', label: 'Company', options: companies, getOptionLabel: (option: any) => option.name },
    { name: 'url', type: 'text', label: 'URL', required: true },
    { name: 'description', type: 'textarea', label: 'Description', minRows: 4, maxRows: 10 },
  ], [companies]);

  return (
    <EntityForm
      mode="edit"
      entityType="protocol"
      entityId={entityId ?? undefined}
      fields={fields}
      values={values}
      onFieldChange={setFieldValue}
      onSubmit={submit}
      submitButtonText="Save"
    />
  );
};

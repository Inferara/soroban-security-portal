import { FC, useMemo } from 'react';
import { addProtocolCall, getCompanyListDataCall } from '../../../../../api/soroban-security-portal/soroban-security-portal-api';
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

export const AddProtocol: FC = () => {
  const currentPageState: CurrentPageState = useMemo(() => ({
    pageName: 'Add Protocol',
    pageCode: 'addProtocol',
    pageUrl: window.location.pathname,
    routePath: 'admin/protocols/add',
  }), []);

  const additionalLoaders = useMemo(() => [
    { key: 'companies', loader: getCompanyListDataCall }
  ], []);

  const submitProtocol = async (values: ProtocolFormValues): Promise<boolean> => {
    const protocolItem: ProtocolItem = {
      id: 0,
      name: values.name,
      url: values.url,
      companyId: values.company?.id,
      description: values.description,
      image: values.image ?? undefined,
      date: new Date(),
      createdBy: '',
    };
    return await addProtocolCall(protocolItem);
  };

  const { values, setFieldValue, submit, additionalData } = useEntityForm<ProtocolItem, ProtocolFormValues>({
    currentPageState,
    mode: 'add',
    submitEntity: submitProtocol,
    initialValues: { name: '', url: '', company: null, description: '', image: null },
    successNavigatePath: '/admin/protocols',
    validate: (v) => v.name !== '' && v.url !== '',
    validationErrorMessage: 'Name and URL are required.',
    submitErrorMessage: 'Protocol creation failed. Probably protocol already exists.',
    additionalLoaders,
  });

  const companies = (additionalData.companies ?? []) as CompanyItem[];

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
      mode="add"
      entityType="protocol"
      fields={fields}
      values={values}
      onFieldChange={setFieldValue}
      onSubmit={submit}
      submitButtonText="Create Protocol"
    />
  );
};

import { FC, useMemo } from 'react';
import { addCompanyCall } from '../../../../../api/soroban-security-portal/soroban-security-portal-api';
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

export const AddCompany: FC = () => {
  const currentPageState: CurrentPageState = useMemo(() => ({
    pageName: 'Add Company',
    pageCode: 'addCompany',
    pageUrl: window.location.pathname,
    routePath: 'admin/companies/add',
  }), []);

  const submitCompany = async (values: CompanyFormValues): Promise<boolean> => {
    const companyItem: CompanyItem = {
      id: 0,
      name: values.name,
      url: values.url,
      description: values.description,
      image: values.image ?? undefined,
      date: new Date(),
      createdBy: '',
    };
    return await addCompanyCall(companyItem);
  };

  const { values, setFieldValue, submit } = useEntityForm<CompanyItem, CompanyFormValues>({
    currentPageState,
    mode: 'add',
    submitEntity: submitCompany,
    initialValues: { name: '', url: '', description: '', image: null },
    successNavigatePath: '/admin/companies',
    validate: (v) => v.name !== '' && v.url !== '',
    validationErrorMessage: 'Name and URL are required.',
    submitErrorMessage: 'Company creation failed. Probably company already exists.',
  });

  const fields: EntityFieldConfig[] = useMemo(() => [
    { name: 'image', type: 'avatar', label: 'Avatar', placeholderFromField: 'name', defaultPlaceholder: 'C' },
    { name: 'name', type: 'text', label: 'Name', required: true },
    { name: 'url', type: 'text', label: 'URL', required: true },
    { name: 'description', type: 'textarea', label: 'Description', minRows: 4, maxRows: 10 },
  ], []);

  return (
    <EntityForm
      mode="add"
      entityType="company"
      fields={fields}
      values={values}
      onFieldChange={setFieldValue}
      onSubmit={submit}
      submitButtonText="Create Company"
    />
  );
};

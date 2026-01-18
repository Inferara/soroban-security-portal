import { FC, useMemo } from 'react';
import { addAuditorCall } from '../../../../../api/soroban-security-portal/soroban-security-portal-api';
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

export const AddAuditor: FC = () => {
  const currentPageState: CurrentPageState = useMemo(() => ({
    pageName: 'Add Auditor',
    pageCode: 'addAuditor',
    pageUrl: window.location.pathname,
    routePath: 'admin/auditors/add',
  }), []);

  const submitAuditor = async (values: AuditorFormValues): Promise<boolean> => {
    const auditorItem: AuditorItem = {
      id: 0,
      name: values.name,
      url: values.url,
      description: values.description,
      image: values.image ?? undefined,
      date: new Date(),
      createdBy: '',
    };
    return await addAuditorCall(auditorItem);
  };

  const { values, setFieldValue, submit } = useEntityForm<AuditorItem, AuditorFormValues>({
    currentPageState,
    mode: 'add',
    submitEntity: submitAuditor,
    initialValues: { name: '', url: '', description: '', image: null },
    successNavigatePath: '/admin/auditors',
    validate: (v) => v.name !== '' && v.url !== '',
    validationErrorMessage: 'Name and URL are required.',
    submitErrorMessage: 'Auditor creation failed. Probably auditor already exists.',
  });

  const fields: EntityFieldConfig[] = useMemo(() => [
    { name: 'image', type: 'avatar', label: 'Avatar', placeholderFromField: 'name', defaultPlaceholder: 'A' },
    { name: 'name', type: 'text', label: 'Name', required: true },
    { name: 'url', type: 'text', label: 'URL', required: true },
    { name: 'description', type: 'textarea', label: 'Description', minRows: 4, maxRows: 10 },
  ], []);

  return (
    <EntityForm
      mode="add"
      entityType="auditor"
      fields={fields}
      values={values}
      onFieldChange={setFieldValue}
      onSubmit={submit}
      submitButtonText="Create Auditor"
    />
  );
};

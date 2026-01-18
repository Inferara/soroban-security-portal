import { FC, useMemo } from 'react';
import { addTagCall } from '../../../../../api/soroban-security-portal/soroban-security-portal-api';
import { TagItem } from '../../../../../api/soroban-security-portal/models/tag';
import { CurrentPageState } from '../../admin-main-window/current-page-slice';
import { EntityForm, EntityFieldConfig } from '../../../../../components/admin';
import { useEntityForm } from '../../../../../hooks/admin';

interface TagFormValues {
  name: string;
  textColor: string;
  bgColor: string;
}

export const AddTag: FC = () => {
  const currentPageState: CurrentPageState = useMemo(() => ({
    pageName: 'Add Tag',
    pageCode: 'addTag',
    pageUrl: window.location.pathname,
    routePath: 'admin/tags/add',
  }), []);

  const submitTag = async (values: TagFormValues): Promise<boolean> => {
    const tagItem: TagItem = {
      id: 0,
      name: values.name,
      bgColor: values.bgColor,
      textColor: values.textColor,
      date: new Date(),
      createdBy: 0,
    };
    return await addTagCall(tagItem);
  };

  const { values, setFieldValue, submit } = useEntityForm<TagItem, TagFormValues>({
    currentPageState,
    mode: 'add',
    submitEntity: submitTag,
    initialValues: { name: '', textColor: '#000000', bgColor: '#FFFFFF' },
    successNavigatePath: '/admin/tags',
    validate: (v) => v.name !== '',
    validationErrorMessage: 'Name field is required.',
    submitErrorMessage: 'Tag creation failed. Probably tag already exists.',
  });

  const fields: EntityFieldConfig[] = useMemo(() => [
    { name: 'name', type: 'text', label: 'Name', required: true },
    { name: 'textColor', type: 'color', label: 'Text Color', required: true },
    { name: 'bgColor', type: 'color', label: 'Background Color', required: true },
  ], []);

  return (
    <EntityForm
      mode="add"
      entityType="auditor" // Tags don't have avatars, using auditor as placeholder
      fields={fields}
      values={values}
      onFieldChange={setFieldValue}
      onSubmit={submit}
      submitButtonText="Create Tag"
    />
  );
};

import { FC, useMemo, useCallback, useRef, useEffect } from 'react';
import { editTagCall, getTagByIdCall } from '../../../../../api/soroban-security-portal/soroban-security-portal-api';
import { TagItem } from '../../../../../api/soroban-security-portal/models/tag';
import { CurrentPageState } from '../../admin-main-window/current-page-slice';
import { EntityForm, EntityFieldConfig } from '../../../../../components/admin';
import { useEntityForm } from '../../../../../hooks/admin';

interface TagFormValues {
  name: string;
  textColor: string;
  bgColor: string;
}

export const EditTag: FC = () => {
  const currentPageState: CurrentPageState = useMemo(() => ({
    pageName: 'Edit Tag',
    pageCode: 'editTag',
    pageUrl: window.location.pathname,
    routePath: 'admin/tags/edit',
  }), []);

  const entityToFormValues = useCallback((tag: TagItem): TagFormValues => ({
    name: tag.name,
    textColor: tag.textColor,
    bgColor: tag.bgColor,
  }), []);

  // Use a ref to store the entity for the submit callback
  const entityRef = useRef<TagItem | null>(null);

  const submitTag = useCallback(async (vals: TagFormValues): Promise<boolean> => {
    const currentEntity = entityRef.current;
    if (!currentEntity) return false;
    const tagItem: TagItem = {
      id: currentEntity.id,
      name: vals.name,
      bgColor: vals.bgColor,
      textColor: vals.textColor,
      date: currentEntity.date,
      createdBy: currentEntity.createdBy,
    };
    return await editTagCall(tagItem);
  }, []);

  const { values, setFieldValue, submit, entity } = useEntityForm<TagItem, TagFormValues>({
    currentPageState,
    mode: 'edit',
    entityIdParam: 'tagId',
    fetchEntity: getTagByIdCall,
    submitEntity: submitTag,
    initialValues: { name: '', textColor: '#000000', bgColor: '#FFFFFF' },
    entityToFormValues,
    successNavigatePath: '/admin/tags',
    validate: (v) => v.name !== '',
    validationErrorMessage: 'Name field is required.',
    submitErrorMessage: 'Tag updating failed.',
  });

  // Keep entityRef in sync with entity from hook
  useEffect(() => {
    entityRef.current = entity ?? null;
  }, [entity]);

  const fields: EntityFieldConfig[] = useMemo(() => [
    { name: 'name', type: 'text', label: 'Name', required: false, disabled: true },
    { name: 'textColor', type: 'color', label: 'Text Color', required: true },
    { name: 'bgColor', type: 'color', label: 'Background Color', required: true },
  ], []);

  return (
    <EntityForm
      mode="edit"
      entityType="auditor" // Tags don't have avatars, using auditor as placeholder
      fields={fields}
      values={values}
      onFieldChange={setFieldValue}
      onSubmit={submit}
      submitButtonText="Save"
    />
  );
};

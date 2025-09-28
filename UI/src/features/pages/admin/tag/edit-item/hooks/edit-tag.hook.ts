import { useEffect, useState } from 'react';
import { editTagCall, getTagByIdCall } from '../../../../../../api/soroban-security-portal/soroban-security-portal-api';
import { useAppDispatch } from '../../../../../../app/hooks';
import { CurrentPageState, setCurrentPage } from '../../../admin-main-window/current-page-slice';
import { useSearchParams } from 'react-router-dom';
import { TagItem } from '../../../../../../api/soroban-security-portal/models/tag';

type UseEditTagProps = {
    currentPageState: CurrentPageState;
};

export const useEditTag = (props: UseEditTagProps) => {
    const { currentPageState } = props;
    const dispatch = useAppDispatch();
    const [searchParams] = useSearchParams();
    const [tag, setTag] = useState<TagItem | null | undefined>(undefined);
    const tagId = parseInt(searchParams.get('tagId') ?? '');

    const editTag = async (tagItem: TagItem): Promise<boolean> => {
        const response = await editTagCall(tagItem);
        return response;
    };

    const getTagById = async (): Promise<void> => {
        if (tagId) {
          const response = await getTagByIdCall(tagId);
          setTag(response);
        } else {
          setTag(null);
        }
      };

    // Set the current page
    useEffect(() => {
        dispatch(setCurrentPage(currentPageState));
        void getTagById();
    }, [dispatch]);

    return {
        editTag, tag, tagId
    };
};

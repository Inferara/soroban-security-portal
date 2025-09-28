import { useEffect } from 'react';
import { addTagCall } from '../../../../../../api/soroban-security-portal/soroban-security-portal-api';
import { useAppDispatch } from '../../../../../../app/hooks';
import { CurrentPageState, setCurrentPage } from '../../../admin-main-window/current-page-slice';
import { TagItem } from '../../../../../../api/soroban-security-portal/models/tag';

type UseAddTagProps = {
    currentPageState: CurrentPageState;
};

export const useAddTag = (props: UseAddTagProps) => {
    const { currentPageState } = props;
    const dispatch = useAppDispatch();

    const addTag = async (TagItem: TagItem): Promise<boolean> => {
        const response = await addTagCall(TagItem);
        return response;
    };

    // Set the current page
    useEffect(() => {
        dispatch(setCurrentPage(currentPageState));
    }, [dispatch]);

    return {
        addTag
    };
};

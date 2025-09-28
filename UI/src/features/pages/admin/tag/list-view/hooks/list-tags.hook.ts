import { useEffect, useState } from 'react';
import { getTagsCall, removeTagCall } from '../../../../../../api/soroban-security-portal/soroban-security-portal-api'; 
import { useAppDispatch } from '../../../../../../app/hooks';
import { CurrentPageState, setCurrentPage } from '../../../admin-main-window/current-page-slice';
import { TagItem } from '../../../../../../api/soroban-security-portal/models/tag';

type UseListTagsProps = {
    currentPageState: CurrentPageState;
};

export const useListTags = (props: UseListTagsProps) => {
    const { currentPageState } = props;
    const [tagListData, setTagListData] = useState<TagItem[]>([]);
    const dispatch = useAppDispatch();

    const getTagListData = async (): Promise<void> => {
        const tagListDataResponse = await getTagsCall();
        setTagListData(tagListDataResponse);
    };

    const tagRemove = async (id: number): Promise<void> => {
        await removeTagCall(id);
        await getTagListData();
    }

    // Set the current page
    useEffect(() => {
        dispatch(setCurrentPage(currentPageState));
        void getTagListData();
    }, [dispatch]);

    return {
        tagListData,
        tagRemove
    };
};

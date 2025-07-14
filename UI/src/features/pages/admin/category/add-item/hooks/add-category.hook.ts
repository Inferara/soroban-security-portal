import { useEffect } from 'react';
import { addCategoryCall } from '../../../../../../api/soroban-security-portal/soroban-security-portal-api';
import { useAppDispatch } from '../../../../../../app/hooks';
import { CurrentPageState, setCurrentPage } from '../../../admin-main-window/current-page-slice';
import { CategoryItem } from '../../../../../../api/soroban-security-portal/models/category';

type UseAddCategoryProps = {
    currentPageState: CurrentPageState;
};

export const useAddCategory = (props: UseAddCategoryProps) => {
    const { currentPageState } = props;
    const dispatch = useAppDispatch();

    const addCategory = async (categoryItem: CategoryItem): Promise<boolean> => {
        const response = await addCategoryCall(categoryItem);
        return response;
    };

    // Set the current page
    useEffect(() => {
        dispatch(setCurrentPage(currentPageState));
    }, [dispatch]);

    return {
        addCategory
    };
};

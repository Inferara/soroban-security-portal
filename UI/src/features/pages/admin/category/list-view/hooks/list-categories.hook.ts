import { useEffect, useState } from 'react';
import { getCategoriesCall, removeCategoryCall } from '../../../../../../api/soroban-security-portal/soroban-security-portal-api'; 
import { useAppDispatch } from '../../../../../../app/hooks';
import { CurrentPageState, setCurrentPage } from '../../../admin-main-window/current-page-slice';
import { CategoryItem } from '../../../../../../api/soroban-security-portal/models/category';

type UseListCategoriesProps = {
    currentPageState: CurrentPageState;
};

export const useListCategories = (props: UseListCategoriesProps) => {
    const { currentPageState } = props;
    const [categoryListData, setCategoryListData] = useState<CategoryItem[]>([]);
    const dispatch = useAppDispatch();

    const getCategoryListData = async (): Promise<void> => {
        const categoryListDataResponse = await getCategoriesCall();
        setCategoryListData(categoryListDataResponse);
    };

    const categoryRemove = async (id: number): Promise<void> => {        
        await removeCategoryCall(id);
        await getCategoryListData();
    }

    // Set the current page
    useEffect(() => {
        dispatch(setCurrentPage(currentPageState));
        void getCategoryListData();
    }, [dispatch]);

    return {
        categoryListData,
        categoryRemove
    };
};

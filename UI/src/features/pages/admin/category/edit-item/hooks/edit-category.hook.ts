import { useEffect, useState } from 'react';
import { editCategoryCall, getCategoryByIdCall } from '../../../../../../api/soroban-security-portal/soroban-security-portal-api';
import { useAppDispatch } from '../../../../../../app/hooks';
import { CurrentPageState, setCurrentPage } from '../../../admin-main-window/current-page-slice';
import { useSearchParams } from 'react-router-dom';
import { CategoryItem } from '../../../../../../api/soroban-security-portal/models/category';

type UseEditCategoryProps = {
    currentPageState: CurrentPageState;
};

export const useEditCategory = (props: UseEditCategoryProps) => {
    const { currentPageState } = props;
    const dispatch = useAppDispatch();
    const [searchParams] = useSearchParams();
    const [category, setCategory] = useState<CategoryItem | null | undefined>(undefined);
    const categoryId = parseInt(searchParams.get('categoryId') ?? '');

    const editCategory = async (categoryItem: CategoryItem): Promise<boolean> => {
        const response = await editCategoryCall(categoryItem);
        return response;
    };

    const getCategoryById = async (): Promise<void> => {
        if (categoryId) {
          const response = await getCategoryByIdCall(categoryId);
          setCategory(response);
        } else {
          setCategory(null);
        }
      };

    // Set the current page
    useEffect(() => {
        dispatch(setCurrentPage(currentPageState));
        void getCategoryById();
    }, [dispatch]);

    return {
        editCategory, category, categoryId
    };
};

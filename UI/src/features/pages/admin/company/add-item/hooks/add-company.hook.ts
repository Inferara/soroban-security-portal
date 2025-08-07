import { useEffect } from 'react';
import { addCompanyCall } from '../../../../../../api/soroban-security-portal/soroban-security-portal-api';
import { useAppDispatch } from '../../../../../../app/hooks';
import { CurrentPageState, setCurrentPage } from '../../../admin-main-window/current-page-slice';
import { CompanyItem } from '../../../../../../api/soroban-security-portal/models/company';

type UseAddCompanyProps = {
    currentPageState: CurrentPageState;
};

export const useAddCompany = (props: UseAddCompanyProps) => {
    const { currentPageState } = props;
    const dispatch = useAppDispatch();

    const addCompany = async (companyItem: CompanyItem): Promise<boolean> => {
        const response = await addCompanyCall(companyItem);
        return response;
    };

    // Set the current page
    useEffect(() => {
        dispatch(setCurrentPage(currentPageState));
    }, [dispatch]);

    return {
        addCompany
    };
};

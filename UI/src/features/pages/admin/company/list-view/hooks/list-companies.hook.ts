import { useEffect, useState } from 'react';
import { getCompanyListDataCall, removeCompanyCall } from '../../../../../../api/soroban-security-portal/soroban-security-portal-api'; 
import { useAppDispatch } from '../../../../../../app/hooks';
import { CurrentPageState, setCurrentPage } from '../../../admin-main-window/current-page-slice';
import { CompanyItem } from '../../../../../../api/soroban-security-portal/models/company';

type UseListCompaniesProps = {
    currentPageState: CurrentPageState;
};

export const useListCompanies = (props: UseListCompaniesProps) => {
    const { currentPageState } = props;
    const [companyListData, setCompanyListData] = useState<CompanyItem[]>([]);
    const dispatch = useAppDispatch();

    const getCompanyListData = async (): Promise<void> => {
        const companyListDataResponse = await getCompanyListDataCall();
        setCompanyListData(companyListDataResponse);
    };

    const companyRemove = async (id: number): Promise<void> => {        
        await removeCompanyCall(id);
        await getCompanyListData();
    }

    // Set the current page
    useEffect(() => {
        dispatch(setCurrentPage(currentPageState));
        void getCompanyListData();
    }, [dispatch]);

    return {
        companyListData,
        companyRemove
    };
};

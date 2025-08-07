import { useEffect, useState } from 'react';
import { editCompanyCall, getCompanyByIdCall } from '../../../../../../api/soroban-security-portal/soroban-security-portal-api';
import { useAppDispatch } from '../../../../../../app/hooks';
import { CurrentPageState, setCurrentPage } from '../../../admin-main-window/current-page-slice';
import { useSearchParams } from 'react-router-dom';
import { CompanyItem } from '../../../../../../api/soroban-security-portal/models/company';

type UseEditCompanyProps = {
    currentPageState: CurrentPageState;
};

export const useEditCompany = (props: UseEditCompanyProps) => {
    const { currentPageState } = props;
    const dispatch = useAppDispatch();
    const [searchParams] = useSearchParams();
    const [company, setCompany] = useState<CompanyItem | null | undefined>(undefined);
    const companyId = parseInt(searchParams.get('companyId') ?? '');

    const editCompany = async (companyItem: CompanyItem): Promise<boolean> => {
        const response = await editCompanyCall(companyItem);
        return response;
    };

    const getCompanyById = async (): Promise<void> => {
        if (companyId) {
          const response = await getCompanyByIdCall(companyId);
          setCompany(response);
        } else {
          setCompany(null);
        }
      };

    // Set the current page
    useEffect(() => {
        dispatch(setCurrentPage(currentPageState));
        void getCompanyById();
    }, [dispatch]);

    return {
        editCompany, company, companyId
    };
};

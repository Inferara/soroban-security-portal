import { useEffect, useState } from 'react';
import { addProtocolCall, getCompanyListDataCall } from '../../../../../../api/soroban-security-portal/soroban-security-portal-api';
import { useAppDispatch } from '../../../../../../app/hooks';
import { CurrentPageState, setCurrentPage } from '../../../admin-main-window/current-page-slice';
import { ProtocolItem } from '../../../../../../api/soroban-security-portal/models/protocol';
import { CompanyItem } from '../../../../../../api/soroban-security-portal/models/company';

type UseAddProtocolProps = {
    currentPageState: CurrentPageState;
};

export const useAddProtocol = (props: UseAddProtocolProps) => {
    const { currentPageState } = props;
    const dispatch = useAppDispatch();
    const [companyListData, setCompanyListData] = useState<CompanyItem[]>([]);

    const addProtocol = async (protocolItem: ProtocolItem): Promise<boolean> => {
        const response = await addProtocolCall(protocolItem);
        return response;
    };

    const getCompanyListData = async (): Promise<void> => {
        const companyListDataResponse = await getCompanyListDataCall();
        setCompanyListData(companyListDataResponse);
    };

    // Set the current page
    useEffect(() => {
        dispatch(setCurrentPage(currentPageState));
        void getCompanyListData();
    }, [dispatch]);

    return {
        addProtocol,
        companyListData
    };
};

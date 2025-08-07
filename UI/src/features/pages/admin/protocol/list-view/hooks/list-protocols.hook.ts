import { useEffect, useState } from 'react';
import { getCompanyListDataCall, getProtocolListDataCall, removeProtocolCall } from '../../../../../../api/soroban-security-portal/soroban-security-portal-api'; 
import { useAppDispatch } from '../../../../../../app/hooks';
import { CurrentPageState, setCurrentPage } from '../../../admin-main-window/current-page-slice';
import { ProtocolItem } from '../../../../../../api/soroban-security-portal/models/protocol';
import { CompanyItem } from '../../../../../../api/soroban-security-portal/models/company';

type UseListProtocolsProps = {
    currentPageState: CurrentPageState;
};

export const useListProtocols = (props: UseListProtocolsProps) => {
    const { currentPageState } = props;
    const [protocolListData, setProtocolListData] = useState<ProtocolItem[]>([]);
    const [companyListData, setCompanyListData] = useState<CompanyItem[]>([]);
    const dispatch = useAppDispatch();

    const getProtocolListData = async (): Promise<void> => {
        const protocolListDataResponse = await getProtocolListDataCall();
        setProtocolListData(protocolListDataResponse);
    };

    const protocolRemove = async (id: number): Promise<void> => {        
        await removeProtocolCall(id);
        await getProtocolListData();
    }

    const getCompanyListData = async (): Promise<void> => {
        const companyListDataResponse = await getCompanyListDataCall();
        setCompanyListData(companyListDataResponse);
    };

    // Set the current page
    useEffect(() => {
        dispatch(setCurrentPage(currentPageState));
        void getProtocolListData();
        void getCompanyListData();
    }, [dispatch]);

    return {
        protocolListData,
        protocolRemove,
        companyListData
    };
};

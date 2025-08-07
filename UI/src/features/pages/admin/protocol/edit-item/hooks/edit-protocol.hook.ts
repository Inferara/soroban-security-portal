import { useEffect, useState } from 'react';
import { editProtocolCall, getCompanyListDataCall, getProtocolByIdCall } from '../../../../../../api/soroban-security-portal/soroban-security-portal-api';
import { useAppDispatch } from '../../../../../../app/hooks';
import { CurrentPageState, setCurrentPage } from '../../../admin-main-window/current-page-slice';
import { useSearchParams } from 'react-router-dom';
import { ProtocolItem } from '../../../../../../api/soroban-security-portal/models/protocol';
import { CompanyItem } from '../../../../../../api/soroban-security-portal/models/company';

type UseEditProtocolProps = {
  currentPageState: CurrentPageState;
};

export const useEditProtocol = (props: UseEditProtocolProps) => {
  const { currentPageState } = props;
  const dispatch = useAppDispatch();
  const [searchParams] = useSearchParams();
  const [protocol, setProtocol] = useState<ProtocolItem | null | undefined>(undefined);
  const [companyListData, setCompanyListData] = useState<CompanyItem[]>([]);
  const protocolId = parseInt(searchParams.get('protocolId') ?? '');

  const editProtocol = async (protocolItem: ProtocolItem): Promise<boolean> => {
    const response = await editProtocolCall(protocolItem);
    return response;
  };

  const getProtocolById = async (): Promise<void> => {
    if (protocolId) {
      const response = await getProtocolByIdCall(protocolId);
      setProtocol(response);
    } else {
      setProtocol(null);
    }
  };

  const getCompanyListData = async (): Promise<void> => {
    const companyListDataResponse = await getCompanyListDataCall();
    setCompanyListData(companyListDataResponse);
  };

  // Set the current page
  useEffect(() => {
    dispatch(setCurrentPage(currentPageState));
    void getProtocolById();
    void getCompanyListData();
  }, [dispatch]);

  return {
    editProtocol, protocol, protocolId, companyListData
  };
};

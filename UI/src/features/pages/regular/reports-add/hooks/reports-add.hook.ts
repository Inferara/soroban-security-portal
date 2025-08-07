import { useEffect, useState } from 'react';
import { addReportCall, getAuditorListDataCall, getCompanyListDataCall, getProtocolListDataCall } from '../../../../../api/soroban-security-portal/soroban-security-portal-api';
import { AddReport } from '../../../../../api/soroban-security-portal/models/report';
import { ProtocolItem } from '../../../../../api/soroban-security-portal/models/protocol';
import { AuditorItem } from '../../../../../api/soroban-security-portal/models/auditor';
import { CompanyItem } from '../../../../../api/soroban-security-portal/models/company';
import { useAppDispatch } from '../../../../../app/hooks';

export const useReportAdd = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [protocolsList, setProtocolsList] = useState<ProtocolItem[]>([]);
  const [companiesList, setCompaniesList] = useState<CompanyItem[]>([]);
  const [auditorsList, setAuditorsList] = useState<AuditorItem[]>([]);
  const dispatch = useAppDispatch();

  const addReport = async (report: AddReport, file?: File | null): Promise<void> => {
    setIsUploading(true);
    try {
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('file', file ?? new Blob());
      formData.append('report', JSON.stringify(report));
      
      // Call API with file upload
      const response = await addReportCall(formData);
      console.log('Report added with file:', response);
    } catch (error) {
      console.error('Error adding report:', error);
      throw error;
    } finally {
      setIsUploading(false);
    }
  };

  const getProtocols = async (): Promise<void> => {
    const response = await getProtocolListDataCall();
    setProtocolsList(response);
  };

  const getCompanies = async (): Promise<void> => {
    const response = await getCompanyListDataCall();
    setCompaniesList(response);
  };

  const getAuditors = async (): Promise<void> => {
    const response = await getAuditorListDataCall();
    setAuditorsList(response);
  };

  useEffect(() => {
    void getProtocols();
    void getCompanies();
    void getAuditors();
  }, [dispatch]);

  return {
    addReport,
    isUploading,
    protocolsList,
    companiesList,
    auditorsList,
  };
}; 
import { useEffect, useState } from 'react';
import { addReportCall, getAuditorListDataCall, getProjectListDataCall } from '../../../../../api/soroban-security-portal/soroban-security-portal-api';
import { AddReport } from '../../../../../api/soroban-security-portal/models/report';
import { ProjectItem } from '../../../../../api/soroban-security-portal/models/project';
import { AuditorItem } from '../../../../../api/soroban-security-portal/models/auditor';
import { useAppDispatch } from '../../../../../app/hooks';

export const useReportAdd = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [projectsList, setProjectsList] = useState<ProjectItem[]>([]);
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

  const getProjects = async (): Promise<void> => {
    const response = await getProjectListDataCall();
    setProjectsList(response);
  };

  const getAuditors = async (): Promise<void> => {
    const response = await getAuditorListDataCall();
    setAuditorsList(response);
  };

  useEffect(() => {
    void getProjects();
    void getAuditors();
  }, [dispatch]);

  return {
    addReport,
    isUploading,
    projectsList,
    auditorsList,
  };
}; 
import { useState } from 'react';
import { addReportCall } from '../../../../../api/soroban-security-portal/soroban-security-portal-api';
import { AddReport } from '../../../../../api/soroban-security-portal/models/report';

export const useReportAdd = () => {
  const [isUploading, setIsUploading] = useState(false);

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

  return {
    addReport,
    isUploading,
  };
}; 
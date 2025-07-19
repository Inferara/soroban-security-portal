import { useEffect, useState } from 'react';
import { 
  editReportCall, 
  getReportByIdCall,
  getAuditorListDataCall, 
  getProjectListDataCall, 
} from '../../../../../../api/soroban-security-portal/soroban-security-portal-api';
import { useAppDispatch } from '../../../../../../app/hooks';
import { CurrentPageState, setCurrentPage } from '../../../admin-main-window/current-page-slice';
import { useSearchParams } from 'react-router-dom';
import { Report } from '../../../../../../api/soroban-security-portal/models/report';
import { ProjectItem } from '../../../../../../api/soroban-security-portal/models/project';
import { AuditorItem } from '../../../../../../api/soroban-security-portal/models/auditor';

type UseEditReportProps = {
    currentPageState: CurrentPageState;
};

export const useEditReport = (props: UseEditReportProps) => {
    const { currentPageState } = props;
    const dispatch = useAppDispatch();
    const [searchParams] = useSearchParams();
    const reportId = parseInt(searchParams.get('reportId') ?? '');
    const [report, setReport] = useState<Report | null | undefined>(undefined);
    const [projectsList, setProjectsList] = useState<ProjectItem[]>([]);
    const [auditorsList, setAuditorsList] = useState<AuditorItem[]>([]);

    const editReport = async (reportItem: Report): Promise<boolean> => {
        const response = await editReportCall(reportItem);
        return response;
    };

    const getReportById = async (): Promise<void> => {
        if (reportId) {
          const response = await getReportByIdCall(reportId);
          setReport(response);
        } else {
          setReport(null);
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

    // Set the current page
    useEffect(() => {
        dispatch(setCurrentPage(currentPageState));
        void getReportById();
        void getProjects();
        void getAuditors();
    }, [dispatch]);

    return {
        editReport, 
        report, 
        reportId,
        projectsList,
        auditorsList,
    };
}; 
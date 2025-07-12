import { useEffect, useState } from 'react';
import { editProjectCall, getProjectByIdCall } from '../../../../../../api/soroban-security-portal/soroban-security-portal-api';
import { useAppDispatch } from '../../../../../../app/hooks';
import { CurrentPageState, setCurrentPage } from '../../../admin-main-window/current-page-slice';
import { useSearchParams } from 'react-router-dom';
import { ProjectItem } from '../../../../../../api/soroban-security-portal/models/project';

type UseEditProjectProps = {
    currentPageState: CurrentPageState;
};

export const useEditProject = (props: UseEditProjectProps) => {
    const { currentPageState } = props;
    const dispatch = useAppDispatch();
    const [searchParams] = useSearchParams();
    const [project, setProject] = useState<ProjectItem | null | undefined>(undefined);
    const projectId = parseInt(searchParams.get('projectId') ?? '');

    const editProject = async (projectItem: ProjectItem): Promise<boolean> => {
        const response = await editProjectCall(projectItem);
        return response;
    };

    const getProjectById = async (): Promise<void> => {
        if (projectId) {
          const response = await getProjectByIdCall(projectId);
          setProject(response);
        } else {
          setProject(null);
        }
      };

    // Set the current page
    useEffect(() => {
        dispatch(setCurrentPage(currentPageState));
        void getProjectById();
    }, [dispatch]);

    return {
        editProject, project, projectId
    };
};

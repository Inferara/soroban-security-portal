import { useEffect, useState } from 'react';
import { getProjectListDataCall, removeProjectCall } from '../../../../../../api/soroban-security-portal/soroban-security-portal-api'; 
import { useAppDispatch } from '../../../../../../app/hooks';
import { CurrentPageState, setCurrentPage } from '../../../admin-main-window/current-page-slice';
import { ProjectItem } from '../../../../../../api/soroban-security-portal/models/project';

type UseListProjectsProps = {
    currentPageState: CurrentPageState;
};

export const useListProjects = (props: UseListProjectsProps) => {
    const { currentPageState } = props;
    const [projectListData, setProjectListData] = useState<ProjectItem[]>([]);
    const dispatch = useAppDispatch();

    const getProjectListData = async (): Promise<void> => {
        const projectListDataResponse = await getProjectListDataCall();
        setProjectListData(projectListDataResponse);
    };

    const projectRemove = async (id: number): Promise<void> => {        
        await removeProjectCall(id);
        await getProjectListData();
    }

    // Set the current page
    useEffect(() => {
        dispatch(setCurrentPage(currentPageState));
        void getProjectListData();
    }, [dispatch]);

    return {
        projectListData,
        projectRemove
    };
};

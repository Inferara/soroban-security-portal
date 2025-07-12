import { useEffect } from 'react';
import { addProjectCall } from '../../../../../../api/soroban-security-portal/soroban-security-portal-api';
import { useAppDispatch } from '../../../../../../app/hooks';
import { CurrentPageState, setCurrentPage } from '../../../admin-main-window/current-page-slice';
import { ProjectItem } from '../../../../../../api/soroban-security-portal/models/project';

type UseAddProjectProps = {
    currentPageState: CurrentPageState;
};

export const useAddProject = (props: UseAddProjectProps) => {
    const { currentPageState } = props;
    const dispatch = useAppDispatch();

    const addProject = async (projectItem: ProjectItem): Promise<boolean> => {
        const response = await addProjectCall(projectItem);
        return response;
    };

    // Set the current page
    useEffect(() => {
        dispatch(setCurrentPage(currentPageState));
    }, [dispatch]);

    return {
        addProject
    };
};

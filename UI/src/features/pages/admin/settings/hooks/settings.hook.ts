import { useEffect, useState } from 'react';
import { getSettingsListCall, saveSettingsCall, rebootCall } from '../../../../../api/soroban-security-portal/soroban-security-portal-api'; 
import { useAppDispatch } from '../../../../../app/hooks';
import { CurrentPageState, setCurrentPage } from '../../admin-main-window/current-page-slice';
import { SettingsItem } from '../../../../../api/soroban-security-portal/models/settings';

type UseSettingsProps = {
    currentPageState: CurrentPageState;
};

export const useSettings = (props: UseSettingsProps) => {
    const { currentPageState } = props;
    const dispatch = useAppDispatch();
    const [settingsListData, setSettingsListData] = useState<SettingsItem[]>([]);

    const getSettingsListData = async (): Promise<void> => {
        const settingsListDataResponse = await getSettingsListCall();
        setSettingsListData(settingsListDataResponse);
    };

    const saveSettings = async (settings: SettingsItem[]): Promise<boolean> => {
        const saveSettingsResponse = await saveSettingsCall(settings);
        return saveSettingsResponse;
    };

    const reboot = async (): Promise<void> => {
        await rebootCall();
    };

      // Set the current page
    useEffect(() => {
        dispatch(setCurrentPage(currentPageState));
        void getSettingsListData();
    }, [dispatch]);

    return {
        saveSettings,
        settingsListData,
        setSettingsListData,
        reboot,
    };
};

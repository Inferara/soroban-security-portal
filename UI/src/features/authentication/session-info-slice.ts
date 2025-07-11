import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '../../app/store';

export interface SessionInfoState {
    fullName: string;
    loginName: string;
    isAuthenticated: boolean;
}

const initialState: SessionInfoState = {
    fullName: 'N/A',
    loginName: 'none',
    isAuthenticated: false,
};

export const sessionInfoSlice = createSlice({
    name: 'sessionInfo',
    initialState,
    reducers: {
        setSessionInfo: (state, action: PayloadAction<SessionInfoState>) => {
            state.fullName = action.payload.fullName;
            state.loginName = action.payload.loginName;
            state.isAuthenticated = action.payload.isAuthenticated;
        },
        logout: (state) => {
            state.fullName = initialState.fullName;
            state.loginName = initialState.loginName;
            state.isAuthenticated = initialState.isAuthenticated;
        },
    },
});

export const { setSessionInfo, logout } = sessionInfoSlice.actions;
export const selectSessionInfo = (state: RootState) => state.sessionInfo;
export default sessionInfoSlice.reducer;

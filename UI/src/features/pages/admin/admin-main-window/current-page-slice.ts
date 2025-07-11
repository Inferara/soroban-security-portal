import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '../../../../app/store';

export interface CurrentPageState {
    pageName: string; 
    pageCode: string; 
    pageUrl: string;
    routePath: string;
}

const initialState: CurrentPageState = {
    pageName: '',
    pageCode: '',
    pageUrl: '',
    routePath: '',
};

export const currentPageSlice = createSlice({
    name: 'currentPageInfo',
    initialState,
    reducers: {
        setCurrentPage: (state, action: PayloadAction<CurrentPageState>) => {
            state.pageName = action.payload.pageName;
            state.pageCode = action.payload.pageCode;
            state.pageUrl = action.payload.pageUrl;
            state.routePath = action.payload.routePath;
        },
    },
});

export const { setCurrentPage } = currentPageSlice.actions;
export const selectCurrentPage = (state: RootState) => state.currentPage;
export default currentPageSlice.reducer;

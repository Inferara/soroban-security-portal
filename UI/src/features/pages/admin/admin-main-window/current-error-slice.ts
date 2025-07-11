import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '../../../../app/store';

export enum ErrorType {
    Error = 'error',
    Warning = 'warning',
    Success = 'success',
}

export interface CurrentErrorState {
    errorText: string;
    errorType: ErrorType;
    isClosed: boolean;
}

const initialState: CurrentErrorState = {
    errorText: '',
    errorType: ErrorType.Error,
    isClosed: true,
};

export const currentErrorSlice = createSlice({
    name: 'currentErrorInfo',
    initialState,
    reducers: {
        setCurrentError: (state, action: PayloadAction<CurrentErrorState>) => {
            state.errorText = action.payload.errorText;
            state.errorType = action.payload.errorType;
            state.isClosed = false;
        },
        closeCurrentError: (state) => {            
            state.isClosed = true;
        },
    },
});

export const { setCurrentError, closeCurrentError } = currentErrorSlice.actions;
export const selectCurrentError = (state: RootState) => state.currentError;
export default currentErrorSlice.reducer;

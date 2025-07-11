import { configureStore, ThunkAction, Action } from '@reduxjs/toolkit';
import sessionInfoReducer from '../features/authentication/session-info-slice';
import currentPageReducer from '../features/pages/admin/admin-main-window/current-page-slice';
import currentErrorReducer from '../features/pages/admin/admin-main-window/current-error-slice';

export const store = configureStore({
    reducer: {
        sessionInfo: sessionInfoReducer,
        currentPage: currentPageReducer,
        currentError: currentErrorReducer,
    },
});

export type AppDispatch = typeof store.dispatch;
export type RootState = ReturnType<typeof store.getState>;
export type AppThunk<ReturnType = void> = ThunkAction<
    ReturnType,
    RootState,
    unknown,
    Action<string>
>;
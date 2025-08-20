import { store } from '../../app/store';
import { setCurrentError, ErrorType } from '../pages/admin/admin-main-window/current-error-slice';

export const showError = async (errorText: string) => {
    store.dispatch(setCurrentError({
        errorText: errorText,
        errorType: ErrorType.Error,
        isClosed: false,
    }));
};

export const showWarning = async (warningText: string) => {
    store.dispatch(setCurrentError({
        errorText: warningText,
        errorType: ErrorType.Warning,
        isClosed: false,
    }));
};

export const showSuccess = async (successText: string) => {
    store.dispatch(setCurrentError({
        errorText: successText,
        errorType: ErrorType.Success,
        isClosed: false,
    }));
};

export const showMessage = async (messageText: string) => {
    store.dispatch(setCurrentError({
        errorText: messageText,
        errorType: ErrorType.Message,
        isClosed: false,
    }));
};

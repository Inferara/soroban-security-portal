import { describe, it, expect } from 'vitest';
import currentErrorReducer, {
  setCurrentError,
  closeCurrentError,
  selectCurrentError,
  CurrentErrorState,
  ErrorType,
} from '../current-error-slice';

describe('currentErrorSlice', () => {
  const initialState: CurrentErrorState = {
    errorText: '',
    errorType: ErrorType.Error,
    isClosed: true,
  };

  describe('reducer', () => {
    it('returns initial state', () => {
      const result = currentErrorReducer(undefined, { type: 'unknown' });
      expect(result).toEqual(initialState);
    });

    it('handles setCurrentError action', () => {
      const errorState: CurrentErrorState = {
        errorText: 'Something went wrong',
        errorType: ErrorType.Error,
        isClosed: false,
      };

      const result = currentErrorReducer(initialState, setCurrentError(errorState));

      expect(result.errorText).toBe('Something went wrong');
      expect(result.errorType).toBe(ErrorType.Error);
      expect(result.isClosed).toBe(false);
    });

    it('sets isClosed to false when setCurrentError is called', () => {
      const closedState: CurrentErrorState = {
        errorText: '',
        errorType: ErrorType.Error,
        isClosed: true,
      };

      const errorState: CurrentErrorState = {
        errorText: 'Error message',
        errorType: ErrorType.Error,
        isClosed: true, // Even if payload says true
      };

      const result = currentErrorReducer(closedState, setCurrentError(errorState));

      // The reducer always sets isClosed to false when setting an error
      expect(result.isClosed).toBe(false);
    });

    it('handles closeCurrentError action', () => {
      const openState: CurrentErrorState = {
        errorText: 'Error message',
        errorType: ErrorType.Error,
        isClosed: false,
      };

      const result = currentErrorReducer(openState, closeCurrentError());

      expect(result.isClosed).toBe(true);
      // Error text and type are preserved
      expect(result.errorText).toBe('Error message');
      expect(result.errorType).toBe(ErrorType.Error);
    });
  });

  describe('ErrorType enum', () => {
    it('has correct values', () => {
      expect(ErrorType.Error).toBe('error');
      expect(ErrorType.Warning).toBe('warning');
      expect(ErrorType.Success).toBe('success');
      expect(ErrorType.Message).toBe('message');
    });
  });

  describe('error type scenarios', () => {
    it('handles Error type', () => {
      const errorState: CurrentErrorState = {
        errorText: 'Critical error occurred',
        errorType: ErrorType.Error,
        isClosed: false,
      };

      const result = currentErrorReducer(initialState, setCurrentError(errorState));
      expect(result.errorType).toBe(ErrorType.Error);
    });

    it('handles Warning type', () => {
      const warningState: CurrentErrorState = {
        errorText: 'This action may have consequences',
        errorType: ErrorType.Warning,
        isClosed: false,
      };

      const result = currentErrorReducer(initialState, setCurrentError(warningState));
      expect(result.errorType).toBe(ErrorType.Warning);
    });

    it('handles Success type', () => {
      const successState: CurrentErrorState = {
        errorText: 'Operation completed successfully',
        errorType: ErrorType.Success,
        isClosed: false,
      };

      const result = currentErrorReducer(initialState, setCurrentError(successState));
      expect(result.errorType).toBe(ErrorType.Success);
    });

    it('handles Message type', () => {
      const messageState: CurrentErrorState = {
        errorText: 'Informational message',
        errorType: ErrorType.Message,
        isClosed: false,
      };

      const result = currentErrorReducer(initialState, setCurrentError(messageState));
      expect(result.errorType).toBe(ErrorType.Message);
    });
  });

  describe('actions', () => {
    it('setCurrentError creates correct action', () => {
      const errorState: CurrentErrorState = {
        errorText: 'Test error',
        errorType: ErrorType.Error,
        isClosed: false,
      };

      const action = setCurrentError(errorState);

      expect(action.type).toBe('currentErrorInfo/setCurrentError');
      expect(action.payload).toEqual(errorState);
    });

    it('closeCurrentError creates correct action', () => {
      const action = closeCurrentError();

      expect(action.type).toBe('currentErrorInfo/closeCurrentError');
      expect(action.payload).toBeUndefined();
    });
  });

  describe('selectors', () => {
    it('selectCurrentError returns current error state', () => {
      const state = {
        currentPage: {
          pageName: '',
          pageCode: '',
          pageUrl: '',
          routePath: '',
        },
        currentError: {
          errorText: 'Error from selector',
          errorType: ErrorType.Warning,
          isClosed: false,
        },
      };

      const result = selectCurrentError(state);

      expect(result).toEqual(state.currentError);
    });
  });

  describe('state transitions', () => {
    it('can transition from closed to open to closed', () => {
      // Initial closed state
      let state = initialState;
      expect(state.isClosed).toBe(true);

      // Open with error
      state = currentErrorReducer(state, setCurrentError({
        errorText: 'Error',
        errorType: ErrorType.Error,
        isClosed: false,
      }));
      expect(state.isClosed).toBe(false);

      // Close
      state = currentErrorReducer(state, closeCurrentError());
      expect(state.isClosed).toBe(true);

      // Open again with different message
      state = currentErrorReducer(state, setCurrentError({
        errorText: 'Another error',
        errorType: ErrorType.Warning,
        isClosed: false,
      }));
      expect(state.isClosed).toBe(false);
      expect(state.errorText).toBe('Another error');
    });

    it('can replace one error with another', () => {
      let state = currentErrorReducer(initialState, setCurrentError({
        errorText: 'First error',
        errorType: ErrorType.Error,
        isClosed: false,
      }));

      state = currentErrorReducer(state, setCurrentError({
        errorText: 'Second error',
        errorType: ErrorType.Warning,
        isClosed: false,
      }));

      expect(state.errorText).toBe('Second error');
      expect(state.errorType).toBe(ErrorType.Warning);
    });
  });
});

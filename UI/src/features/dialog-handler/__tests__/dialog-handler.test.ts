import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { showError, showWarning, showSuccess, showMessage } from '../dialog-handler';
import { ErrorType } from '../../pages/admin/admin-main-window/current-error-slice';

// Mock the store
const mockDispatch = vi.fn();
vi.mock('../../../app/store', () => ({
  store: {
    dispatch: (action: unknown) => mockDispatch(action),
  },
}));

describe('dialog-handler', () => {
  beforeEach(() => {
    mockDispatch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('showError', () => {
    it('dispatches error with correct payload', async () => {
      await showError('Test error message');

      expect(mockDispatch).toHaveBeenCalledTimes(1);
      const dispatchedAction = mockDispatch.mock.calls[0][0];
      expect(dispatchedAction.type).toBe('currentErrorInfo/setCurrentError');
      expect(dispatchedAction.payload).toEqual({
        errorText: 'Test error message',
        errorType: ErrorType.Error,
        isClosed: false,
      });
    });

    it('handles empty error message', async () => {
      await showError('');

      const dispatchedAction = mockDispatch.mock.calls[0][0];
      expect(dispatchedAction.payload.errorText).toBe('');
      expect(dispatchedAction.payload.errorType).toBe(ErrorType.Error);
    });

    it('handles error message with special characters', async () => {
      const specialMessage = 'Error: <script>alert("xss")</script>';
      await showError(specialMessage);

      const dispatchedAction = mockDispatch.mock.calls[0][0];
      expect(dispatchedAction.payload.errorText).toBe(specialMessage);
    });
  });

  describe('showWarning', () => {
    it('dispatches warning with correct payload', async () => {
      await showWarning('Test warning message');

      expect(mockDispatch).toHaveBeenCalledTimes(1);
      const dispatchedAction = mockDispatch.mock.calls[0][0];
      expect(dispatchedAction.type).toBe('currentErrorInfo/setCurrentError');
      expect(dispatchedAction.payload).toEqual({
        errorText: 'Test warning message',
        errorType: ErrorType.Warning,
        isClosed: false,
      });
    });

    it('handles multiline warning message', async () => {
      const multilineMessage = 'Warning line 1\nWarning line 2\nWarning line 3';
      await showWarning(multilineMessage);

      const dispatchedAction = mockDispatch.mock.calls[0][0];
      expect(dispatchedAction.payload.errorText).toBe(multilineMessage);
    });
  });

  describe('showSuccess', () => {
    it('dispatches success with correct payload', async () => {
      await showSuccess('Operation completed successfully');

      expect(mockDispatch).toHaveBeenCalledTimes(1);
      const dispatchedAction = mockDispatch.mock.calls[0][0];
      expect(dispatchedAction.type).toBe('currentErrorInfo/setCurrentError');
      expect(dispatchedAction.payload).toEqual({
        errorText: 'Operation completed successfully',
        errorType: ErrorType.Success,
        isClosed: false,
      });
    });

    it('handles long success message', async () => {
      const longMessage = 'A'.repeat(1000);
      await showSuccess(longMessage);

      const dispatchedAction = mockDispatch.mock.calls[0][0];
      expect(dispatchedAction.payload.errorText).toBe(longMessage);
    });
  });

  describe('showMessage', () => {
    it('dispatches message with correct payload', async () => {
      await showMessage('Informational message');

      expect(mockDispatch).toHaveBeenCalledTimes(1);
      const dispatchedAction = mockDispatch.mock.calls[0][0];
      expect(dispatchedAction.type).toBe('currentErrorInfo/setCurrentError');
      expect(dispatchedAction.payload).toEqual({
        errorText: 'Informational message',
        errorType: ErrorType.Message,
        isClosed: false,
      });
    });

    it('handles unicode characters in message', async () => {
      const unicodeMessage = '操作成功 ✓ Успех 🎉';
      await showMessage(unicodeMessage);

      const dispatchedAction = mockDispatch.mock.calls[0][0];
      expect(dispatchedAction.payload.errorText).toBe(unicodeMessage);
    });
  });

  describe('isClosed flag', () => {
    it('all functions set isClosed to false', async () => {
      await showError('Error');
      expect(mockDispatch.mock.calls[0][0].payload.isClosed).toBe(false);

      mockDispatch.mockClear();
      await showWarning('Warning');
      expect(mockDispatch.mock.calls[0][0].payload.isClosed).toBe(false);

      mockDispatch.mockClear();
      await showSuccess('Success');
      expect(mockDispatch.mock.calls[0][0].payload.isClosed).toBe(false);

      mockDispatch.mockClear();
      await showMessage('Message');
      expect(mockDispatch.mock.calls[0][0].payload.isClosed).toBe(false);
    });
  });

  describe('ErrorType values', () => {
    it('uses correct ErrorType enum values', async () => {
      await showError('e');
      expect(mockDispatch.mock.calls[0][0].payload.errorType).toBe('error');

      mockDispatch.mockClear();
      await showWarning('w');
      expect(mockDispatch.mock.calls[0][0].payload.errorType).toBe('warning');

      mockDispatch.mockClear();
      await showSuccess('s');
      expect(mockDispatch.mock.calls[0][0].payload.errorType).toBe('success');

      mockDispatch.mockClear();
      await showMessage('m');
      expect(mockDispatch.mock.calls[0][0].payload.errorType).toBe('message');
    });
  });
});

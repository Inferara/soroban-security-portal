import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { ConfirmDialog } from '../confirm-dialog';

const theme = createTheme();

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
);

describe('ConfirmDialog', () => {
  const defaultProps = {
    title: 'Confirm Action',
    message: 'Are you sure you want to proceed?',
    okButtonText: 'Yes',
    cancelButtonText: 'No',
    show: true,
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  beforeEach(() => {
    defaultProps.onConfirm = vi.fn();
    defaultProps.onCancel = vi.fn();
  });

  describe('rendering', () => {
    it('renders when show is true', () => {
      render(<ConfirmDialog {...defaultProps} />, { wrapper });

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('does not render when show is false', () => {
      render(<ConfirmDialog {...defaultProps} show={false} />, { wrapper });

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('displays the title', () => {
      render(<ConfirmDialog {...defaultProps} />, { wrapper });

      expect(screen.getByText('Confirm Action')).toBeInTheDocument();
    });

    it('displays the message', () => {
      render(<ConfirmDialog {...defaultProps} />, { wrapper });

      expect(screen.getByText('Are you sure you want to proceed?')).toBeInTheDocument();
    });

    it('displays custom button texts', () => {
      render(
        <ConfirmDialog
          {...defaultProps}
          okButtonText="Confirm"
          cancelButtonText="Abort"
        />,
        { wrapper }
      );

      expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Abort' })).toBeInTheDocument();
    });

    it('renders ReactNode as message', () => {
      const complexMessage = (
        <div>
          <strong>Warning:</strong> This action cannot be undone.
        </div>
      );

      render(
        <ConfirmDialog {...defaultProps} message={complexMessage} />,
        { wrapper }
      );

      expect(screen.getByText('Warning:')).toBeInTheDocument();
      expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('calls onConfirm when ok button is clicked', () => {
      render(<ConfirmDialog {...defaultProps} />, { wrapper });

      fireEvent.click(screen.getByRole('button', { name: 'Yes' }));

      expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1);
    });

    it('calls onCancel when cancel button is clicked', () => {
      render(<ConfirmDialog {...defaultProps} />, { wrapper });

      fireEvent.click(screen.getByRole('button', { name: 'No' }));

      expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
    });

    it('calls onCancel when dialog is closed via backdrop', () => {
      render(<ConfirmDialog {...defaultProps} />, { wrapper });

      // Find the backdrop and click it
      const backdrop = document.querySelector('.MuiBackdrop-root');
      if (backdrop) {
        fireEvent.click(backdrop);
      }

      expect(defaultProps.onCancel).toHaveBeenCalled();
    });

    it('calls onCancel when Escape key is pressed', () => {
      render(<ConfirmDialog {...defaultProps} />, { wrapper });

      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

      expect(defaultProps.onCancel).toHaveBeenCalled();
    });
  });

  describe('focus management', () => {
    it('auto-focuses the ok button', () => {
      render(<ConfirmDialog {...defaultProps} />, { wrapper });

      const okButton = screen.getByRole('button', { name: 'Yes' });
      expect(okButton).toHaveFocus();
    });
  });

  describe('different content scenarios', () => {
    it('handles long title', () => {
      const longTitle = 'This is a very long confirmation dialog title that might wrap';
      render(<ConfirmDialog {...defaultProps} title={longTitle} />, { wrapper });

      expect(screen.getByText(longTitle)).toBeInTheDocument();
    });

    it('handles long message', () => {
      const longMessage = 'This is a very long message that explains in detail what will happen when the user confirms this action. It might include warnings and additional information.';
      render(<ConfirmDialog {...defaultProps} message={longMessage} />, { wrapper });

      expect(screen.getByText(longMessage)).toBeInTheDocument();
    });

    it('handles empty button texts', () => {
      render(
        <ConfirmDialog
          {...defaultProps}
          okButtonText=""
          cancelButtonText=""
        />,
        { wrapper }
      );

      // Dialog should still render with buttons (even if empty text)
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBe(2);
    });
  });

  describe('accessibility', () => {
    it('has proper dialog role', () => {
      render(<ConfirmDialog {...defaultProps} />, { wrapper });

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('has accessible buttons', () => {
      render(<ConfirmDialog {...defaultProps} />, { wrapper });

      expect(screen.getByRole('button', { name: 'Yes' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'No' })).toBeInTheDocument();
    });
  });
});

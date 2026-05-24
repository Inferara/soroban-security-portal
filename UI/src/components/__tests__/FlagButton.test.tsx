import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { FlagButton } from '../FlagButton';

// Mock the API module
vi.mock('../../api/soroban-security-portal/soroban-security-portal-api', () => ({
    flagContentCall: vi.fn(),
}));

// Mock the dialog-handler module
vi.mock('../../features/dialog-handler/dialog-handler', () => ({
    showError: vi.fn(),
}));

import { flagContentCall } from '../../api/soroban-security-portal/soroban-security-portal-api';
import { showError } from '../../features/dialog-handler/dialog-handler';

const theme = createTheme();
const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ThemeProvider theme={theme}>{children}</ThemeProvider>
);

const mockFlagContentCall = vi.mocked(flagContentCall);
const mockShowError = vi.mocked(showError);

describe('FlagButton', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the flag icon button with "Report content" tooltip/aria-label', () => {
        render(<FlagButton contentType="vulnerability" contentId={1} />, { wrapper });
        expect(screen.getByRole('button', { name: /report content/i })).toBeInTheDocument();
    });

    it('clicking the button opens the dialog', () => {
        render(<FlagButton contentType="vulnerability" contentId={1} />, { wrapper });

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /report content/i }));

        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Report content')).toBeInTheDocument();
    });

    it('dialog has Cancel and Report buttons', () => {
        render(<FlagButton contentType="vulnerability" contentId={1} />, { wrapper });
        fireEvent.click(screen.getByRole('button', { name: /report content/i }));

        expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^report$/i })).toBeInTheDocument();
    });

    it('Cancel button closes the dialog without calling API', async () => {
        render(<FlagButton contentType="vulnerability" contentId={1} />, { wrapper });
        fireEvent.click(screen.getByRole('button', { name: /report content/i }));
        expect(screen.getByRole('dialog')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
        expect(mockFlagContentCall).not.toHaveBeenCalled();
    });

    it('clicking Report calls flagContentCall with correct args and closes dialog on success', async () => {
        mockFlagContentCall.mockResolvedValue(true);

        render(<FlagButton contentType="vulnerability" contentId={1} />, { wrapper });
        fireEvent.click(screen.getByRole('button', { name: /report content/i }));

        // Default reason is 'spam'
        fireEvent.click(screen.getByRole('button', { name: /^report$/i }));

        await waitFor(() => {
            expect(mockFlagContentCall).toHaveBeenCalledWith('vulnerability', 1, 'spam', undefined);
        });

        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
    });

    it('disables the Report button while the request is in flight', async () => {
        let resolveFlag: (value: boolean) => void = () => {};
        mockFlagContentCall.mockReturnValue(
            new Promise<boolean>((resolve) => {
                resolveFlag = resolve;
            })
        );

        render(<FlagButton contentType="vulnerability" contentId={1} />, { wrapper });
        fireEvent.click(screen.getByRole('button', { name: /report content/i }));

        const reportButton = screen.getByRole('button', { name: /^report$/i });
        fireEvent.click(reportButton);

        // While the promise is pending, the Report button should be disabled
        await waitFor(() => {
            expect(reportButton).toBeDisabled();
        });

        // Resolve the request and confirm the dialog closes
        resolveFlag(true);
        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
    });

    it('button is disabled and shows "Reported" tooltip after successful flag', async () => {
        mockFlagContentCall.mockResolvedValue(true);

        render(<FlagButton contentType="vulnerability" contentId={1} />, { wrapper });
        fireEvent.click(screen.getByRole('button', { name: /report content/i }));
        fireEvent.click(screen.getByRole('button', { name: /^report$/i }));

        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });

        const btn = screen.getByRole('button', { name: /reported/i });
        expect(btn).toBeDisabled();
    });

    it('when flagContentCall rejects with 409, sets reported=true and does NOT call showError', async () => {
        const err409 = Object.assign(new Error('Conflict'), { response: { status: 409 } });
        mockFlagContentCall.mockRejectedValue(err409);

        render(<FlagButton contentType="vulnerability" contentId={1} />, { wrapper });
        fireEvent.click(screen.getByRole('button', { name: /report content/i }));
        fireEvent.click(screen.getByRole('button', { name: /^report$/i }));

        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });

        const btn = screen.getByRole('button', { name: /reported/i });
        expect(btn).toBeDisabled();
        expect(mockShowError).not.toHaveBeenCalled();
    });

    it('when flagContentCall rejects with non-409 error, calls showError', async () => {
        const err500 = Object.assign(new Error('Server Error'), { response: { status: 500 } });
        mockFlagContentCall.mockRejectedValue(err500);

        render(<FlagButton contentType="vulnerability" contentId={1} />, { wrapper });
        fireEvent.click(screen.getByRole('button', { name: /report content/i }));
        fireEvent.click(screen.getByRole('button', { name: /^report$/i }));

        await waitFor(() => {
            expect(mockShowError).toHaveBeenCalled();
        });

        // Dialog should be closed
        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
        // Button should NOT be in reported state
        expect(screen.queryByRole('button', { name: /reported/i })).not.toBeInTheDocument();
    });

    it('works for report contentType', async () => {
        mockFlagContentCall.mockResolvedValue(true);

        render(<FlagButton contentType="report" contentId={42} />, { wrapper });
        fireEvent.click(screen.getByRole('button', { name: /report content/i }));
        fireEvent.click(screen.getByRole('button', { name: /^report$/i }));

        await waitFor(() => {
            expect(mockFlagContentCall).toHaveBeenCalledWith('report', 42, 'spam', undefined);
        });
    });
});

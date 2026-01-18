import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { ReportManagement } from '../list-reports';
import currentPageReducer from '../../../admin-main-window/current-page-slice';
import currentErrorReducer from '../../../admin-main-window/current-error-slice';
import { Role } from '../../../../../../api/soroban-security-portal/models/role';

// Mock useAuth
const mockAuth = {
    user: {
        profile: {
            role: Role.Admin,
        },
    },
    isAuthenticated: true,
};

vi.mock('react-oidc-context', () => ({
    useAuth: () => mockAuth,
}));

// Mock the hook
const mockUseListReports = {
    reportListData: [],
    reportRemove: vi.fn(),
    reportApprove: vi.fn(),
    reportReject: vi.fn(),
    downloadReport: vi.fn(),
    extractVulnerabilities: vi.fn(),
    extractingReportId: null as number | null,
    extractionResult: null as {
        totalExtracted: number;
        totalCreated: number;
        duplicatesSkipped: number;
        createdVulnerabilityIds: number[];
        validationWarnings: string[];
        processingErrors: string[];
        processingTimeMs: number;
    } | null,
    extractionError: null as string | null,
    clearExtractionResult: vi.fn(),
};

vi.mock('../hooks', () => ({
    useListReports: () => mockUseListReports,
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

const theme = createTheme();

const createTestStore = () => {
    return configureStore({
        reducer: {
            currentPage: currentPageReducer,
            currentError: currentErrorReducer,
        },
    });
};

const renderComponent = () => {
    const store = createTestStore();
    return render(
        <Provider store={store}>
            <ThemeProvider theme={theme}>
                <MemoryRouter>
                    <ReportManagement />
                </MemoryRouter>
            </ThemeProvider>
        </Provider>
    );
};

describe('ReportManagement - Extract Vulnerabilities Feature', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseListReports.reportListData = [];
        mockUseListReports.extractingReportId = null;
        mockUseListReports.extractionResult = null;
        mockUseListReports.extractionError = null;
        mockAuth.user = { profile: { role: Role.Admin } };
    });

    describe('Extract button visibility', () => {
        it('shows extract button for Admin users', () => {
            // Arrange
            mockAuth.user = { profile: { role: Role.Admin } };
            mockUseListReports.reportListData = [
                {
                    id: 1,
                    name: 'Test Report',
                    status: 'Approved',
                    date: '2024-01-15T00:00:00',
                    protocolName: 'Protocol 1',
                    auditorName: 'Auditor 1',
                    companyName: 'Company 1',
                },
            ];

            // Act
            renderComponent();

            // Assert
            expect(screen.getByLabelText('Extract vulnerabilities from report using AI')).toBeInTheDocument();
        });

        it('shows extract button for Moderator users', () => {
            // Arrange
            mockAuth.user = { profile: { role: Role.Moderator } };
            mockUseListReports.reportListData = [
                {
                    id: 1,
                    name: 'Test Report',
                    status: 'Approved',
                    date: '2024-01-15T00:00:00',
                    protocolName: 'Protocol 1',
                    auditorName: 'Auditor 1',
                    companyName: 'Company 1',
                },
            ];

            // Act
            renderComponent();

            // Assert
            expect(screen.getByLabelText('Extract vulnerabilities from report using AI')).toBeInTheDocument();
        });

        it('does not show extract button for Contributor users', () => {
            // Arrange
            mockAuth.user = { profile: { role: Role.Contributor } };
            mockUseListReports.reportListData = [
                {
                    id: 1,
                    name: 'Test Report',
                    status: 'Approved',
                    date: '2024-01-15T00:00:00',
                    protocolName: 'Protocol 1',
                    auditorName: 'Auditor 1',
                    companyName: 'Company 1',
                },
            ];

            // Act
            renderComponent();

            // Assert
            expect(screen.queryByLabelText('Extract vulnerabilities from report using AI')).not.toBeInTheDocument();
        });

        it('does not show extract button for User role', () => {
            // Arrange
            mockAuth.user = { profile: { role: Role.User } };
            mockUseListReports.reportListData = [
                {
                    id: 1,
                    name: 'Test Report',
                    status: 'Approved',
                    date: '2024-01-15T00:00:00',
                    protocolName: 'Protocol 1',
                    auditorName: 'Auditor 1',
                    companyName: 'Company 1',
                },
            ];

            // Act
            renderComponent();

            // Assert
            expect(screen.queryByLabelText('Extract vulnerabilities from report using AI')).not.toBeInTheDocument();
        });
    });

    describe('Extract confirmation dialog', () => {
        it('opens confirmation dialog when extract button is clicked', async () => {
            // Arrange
            mockAuth.user = { profile: { role: Role.Admin } };
            mockUseListReports.reportListData = [
                {
                    id: 1,
                    name: 'Test Report',
                    status: 'Approved',
                    date: '2024-01-15T00:00:00',
                    protocolName: 'Protocol 1',
                    auditorName: 'Auditor 1',
                    companyName: 'Company 1',
                },
            ];

            // Act
            renderComponent();
            const extractButton = screen.getByLabelText('Extract vulnerabilities from report using AI');
            fireEvent.click(extractButton);

            // Assert
            await waitFor(() => {
                expect(screen.getByText('Extract Vulnerabilities')).toBeInTheDocument();
            });
        });

        it('shows important warnings in confirmation dialog', async () => {
            // Arrange
            mockAuth.user = { profile: { role: Role.Admin } };
            mockUseListReports.reportListData = [
                {
                    id: 1,
                    name: 'Test Report',
                    status: 'Approved',
                    date: '2024-01-15T00:00:00',
                    protocolName: 'Protocol 1',
                    auditorName: 'Auditor 1',
                    companyName: 'Company 1',
                },
            ];

            // Act
            renderComponent();
            const extractButton = screen.getByLabelText('Extract vulnerabilities from report using AI');
            fireEvent.click(extractButton);

            // Assert
            await waitFor(() => {
                expect(screen.getByText(/AI extraction may not be 100% accurate/i)).toBeInTheDocument();
                expect(screen.getByText(/Extracted vulnerabilities require manual review/i)).toBeInTheDocument();
            });
        });

        it('closes confirmation dialog when Cancel is clicked', async () => {
            // Arrange
            mockAuth.user = { profile: { role: Role.Admin } };
            mockUseListReports.reportListData = [
                {
                    id: 1,
                    name: 'Test Report',
                    status: 'Approved',
                    date: '2024-01-15T00:00:00',
                    protocolName: 'Protocol 1',
                    auditorName: 'Auditor 1',
                    companyName: 'Company 1',
                },
            ];

            // Act
            renderComponent();
            const extractButton = screen.getByLabelText('Extract vulnerabilities from report using AI');
            fireEvent.click(extractButton);

            await waitFor(() => {
                expect(screen.getByText('Extract Vulnerabilities')).toBeInTheDocument();
            });

            const cancelButton = screen.getByRole('button', { name: 'Cancel' });
            fireEvent.click(cancelButton);

            // Assert
            await waitFor(() => {
                expect(screen.queryByRole('dialog', { name: /Extract Vulnerabilities/i })).not.toBeInTheDocument();
            });
        });

        it('calls extractVulnerabilities when Extract is clicked', async () => {
            // Arrange
            mockAuth.user = { profile: { role: Role.Admin } };
            mockUseListReports.reportListData = [
                {
                    id: 42,
                    name: 'Test Report',
                    status: 'Approved',
                    date: '2024-01-15T00:00:00',
                    protocolName: 'Protocol 1',
                    auditorName: 'Auditor 1',
                    companyName: 'Company 1',
                },
            ];

            // Act
            renderComponent();
            const extractButton = screen.getByLabelText('Extract vulnerabilities from report using AI');
            fireEvent.click(extractButton);

            await waitFor(() => {
                expect(screen.getByText('Extract Vulnerabilities')).toBeInTheDocument();
            });

            const confirmExtractButton = screen.getByRole('button', { name: 'Extract' });
            fireEvent.click(confirmExtractButton);

            // Assert
            await waitFor(() => {
                expect(mockUseListReports.extractVulnerabilities).toHaveBeenCalledWith(42);
            });
        });
    });

    describe('Extraction loading state', () => {
        it('shows loading spinner on extract button when extracting', () => {
            // Arrange
            mockAuth.user = { profile: { role: Role.Admin } };
            mockUseListReports.extractingReportId = 1;
            mockUseListReports.reportListData = [
                {
                    id: 1,
                    name: 'Test Report',
                    status: 'Approved',
                    date: '2024-01-15T00:00:00',
                    protocolName: 'Protocol 1',
                    auditorName: 'Auditor 1',
                    companyName: 'Company 1',
                },
            ];

            // Act
            renderComponent();

            // Assert
            expect(screen.getByRole('progressbar')).toBeInTheDocument();
        });

        it('disables extract button when extraction is in progress', () => {
            // Arrange
            mockAuth.user = { profile: { role: Role.Admin } };
            mockUseListReports.extractingReportId = 1;
            mockUseListReports.reportListData = [
                {
                    id: 1,
                    name: 'Test Report',
                    status: 'Approved',
                    date: '2024-01-15T00:00:00',
                    protocolName: 'Protocol 1',
                    auditorName: 'Auditor 1',
                    companyName: 'Company 1',
                },
            ];

            // Act
            renderComponent();

            // Assert
            const extractButton = screen.getByLabelText('Extract vulnerabilities from report using AI');
            expect(extractButton).toBeDisabled();
        });

        it('shows "Extracting..." text on dialog button during extraction', async () => {
            // Arrange
            mockAuth.user = { profile: { role: Role.Admin } };
            mockUseListReports.extractingReportId = 1;
            mockUseListReports.reportListData = [
                {
                    id: 1,
                    name: 'Test Report',
                    status: 'Approved',
                    date: '2024-01-15T00:00:00',
                    protocolName: 'Protocol 1',
                    auditorName: 'Auditor 1',
                    companyName: 'Company 1',
                },
            ];

            // First set no extracting, open dialog
            mockUseListReports.extractingReportId = null;
            const { rerender } = render(
                <Provider store={createTestStore()}>
                    <ThemeProvider theme={theme}>
                        <MemoryRouter>
                            <ReportManagement />
                        </MemoryRouter>
                    </ThemeProvider>
                </Provider>
            );

            // Open dialog
            const extractButton = screen.getByLabelText('Extract vulnerabilities from report using AI');
            fireEvent.click(extractButton);

            await waitFor(() => {
                expect(screen.getByText('Extract Vulnerabilities')).toBeInTheDocument();
            });

            // Now set extracting
            mockUseListReports.extractingReportId = 1;
            rerender(
                <Provider store={createTestStore()}>
                    <ThemeProvider theme={theme}>
                        <MemoryRouter>
                            <ReportManagement />
                        </MemoryRouter>
                    </ThemeProvider>
                </Provider>
            );

            // Assert
            expect(screen.getByRole('button', { name: /Extracting/i })).toBeInTheDocument();
        });
    });

    describe('Extraction result dialog', () => {
        it('shows result dialog when extraction completes', () => {
            // Arrange
            mockAuth.user = { profile: { role: Role.Admin } };
            mockUseListReports.extractionResult = {
                totalExtracted: 5,
                totalCreated: 4,
                duplicatesSkipped: 1,
                createdVulnerabilityIds: [100, 101, 102, 103],
                validationWarnings: [],
                processingErrors: [],
                processingTimeMs: 1500,
            };

            // Act
            renderComponent();

            // Assert
            expect(screen.getByText('Extraction Complete')).toBeInTheDocument();
        });

        it('displays extraction statistics in result dialog', () => {
            // Arrange
            mockAuth.user = { profile: { role: Role.Admin } };
            mockUseListReports.extractionResult = {
                totalExtracted: 10,
                totalCreated: 8,
                duplicatesSkipped: 2,
                createdVulnerabilityIds: [1, 2, 3, 4, 5, 6, 7, 8],
                validationWarnings: [],
                processingErrors: [],
                processingTimeMs: 5000,
            };

            // Act
            renderComponent();

            // Assert
            expect(screen.getByText(/Vulnerabilities found: 10/i)).toBeInTheDocument();
            expect(screen.getByText(/New vulnerabilities created: 8/i)).toBeInTheDocument();
            expect(screen.getByText(/Duplicates skipped: 2/i)).toBeInTheDocument();
            expect(screen.getByText(/Processing time: 5.0s/i)).toBeInTheDocument();
        });

        it('displays validation warnings in result dialog', () => {
            // Arrange
            mockAuth.user = { profile: { role: Role.Admin } };
            mockUseListReports.extractionResult = {
                totalExtracted: 2,
                totalCreated: 2,
                duplicatesSkipped: 0,
                createdVulnerabilityIds: [1, 2],
                validationWarnings: ['Warning 1', 'Warning 2'],
                processingErrors: [],
                processingTimeMs: 1000,
            };

            // Act
            renderComponent();

            // Assert
            expect(screen.getByText('Validation Warnings')).toBeInTheDocument();
            expect(screen.getByText('Warning 1')).toBeInTheDocument();
            expect(screen.getByText('Warning 2')).toBeInTheDocument();
        });

        it('displays processing errors in result dialog', () => {
            // Arrange
            mockAuth.user = { profile: { role: Role.Admin } };
            mockUseListReports.extractionResult = {
                totalExtracted: 1,
                totalCreated: 1,
                duplicatesSkipped: 0,
                createdVulnerabilityIds: [1],
                validationWarnings: [],
                processingErrors: ['Error 1', 'Error 2'],
                processingTimeMs: 500,
            };

            // Act
            renderComponent();

            // Assert
            expect(screen.getByText('Processing Errors')).toBeInTheDocument();
            expect(screen.getByText('Error 1')).toBeInTheDocument();
            expect(screen.getByText('Error 2')).toBeInTheDocument();
        });

        it('calls clearExtractionResult when Close is clicked', async () => {
            // Arrange
            mockAuth.user = { profile: { role: Role.Admin } };
            mockUseListReports.extractionResult = {
                totalExtracted: 1,
                totalCreated: 1,
                duplicatesSkipped: 0,
                createdVulnerabilityIds: [1],
                validationWarnings: [],
                processingErrors: [],
                processingTimeMs: 100,
            };

            // Act
            renderComponent();
            const closeButton = screen.getByRole('button', { name: 'Close' });
            fireEvent.click(closeButton);

            // Assert
            expect(mockUseListReports.clearExtractionResult).toHaveBeenCalled();
        });

        it('navigates to vulnerabilities page when View Vulnerabilities is clicked', async () => {
            // Arrange
            mockAuth.user = { profile: { role: Role.Admin } };
            mockUseListReports.extractionResult = {
                totalExtracted: 1,
                totalCreated: 1,
                duplicatesSkipped: 0,
                createdVulnerabilityIds: [1],
                validationWarnings: [],
                processingErrors: [],
                processingTimeMs: 100,
            };

            // Act
            renderComponent();
            const viewButton = screen.getByRole('button', { name: 'View Vulnerabilities' });
            fireEvent.click(viewButton);

            // Assert
            expect(mockNavigate).toHaveBeenCalledWith('/admin/vulnerabilities');
            expect(mockUseListReports.clearExtractionResult).toHaveBeenCalled();
        });
    });

    describe('Extraction error dialog', () => {
        it('shows error dialog when extraction fails', () => {
            // Arrange
            mockAuth.user = { profile: { role: Role.Admin } };
            mockUseListReports.extractionError = 'Report not found';

            // Act
            renderComponent();

            // Assert
            expect(screen.getByText('Extraction Failed')).toBeInTheDocument();
            expect(screen.getByText('Report not found')).toBeInTheDocument();
        });

        it('calls clearExtractionResult when Close is clicked on error dialog', async () => {
            // Arrange
            mockAuth.user = { profile: { role: Role.Admin } };
            mockUseListReports.extractionError = 'Some error';

            // Act
            renderComponent();
            const closeButton = screen.getByRole('button', { name: 'Close' });
            fireEvent.click(closeButton);

            // Assert
            expect(mockUseListReports.clearExtractionResult).toHaveBeenCalled();
        });
    });

    describe('Accessibility', () => {
        it('extract button has appropriate aria-label', () => {
            // Arrange
            mockAuth.user = { profile: { role: Role.Admin } };
            mockUseListReports.reportListData = [
                {
                    id: 1,
                    name: 'Test Report',
                    status: 'Approved',
                    date: '2024-01-15T00:00:00',
                    protocolName: 'Protocol 1',
                    auditorName: 'Auditor 1',
                    companyName: 'Company 1',
                },
            ];

            // Act
            renderComponent();

            // Assert
            expect(screen.getByLabelText('Extract vulnerabilities from report using AI')).toBeInTheDocument();
        });

        it('result dialog has aria-live region for screen readers', () => {
            // Arrange
            mockAuth.user = { profile: { role: Role.Admin } };
            mockUseListReports.extractionResult = {
                totalExtracted: 1,
                totalCreated: 1,
                duplicatesSkipped: 0,
                createdVulnerabilityIds: [1],
                validationWarnings: [],
                processingErrors: [],
                processingTimeMs: 100,
            };

            // Act
            renderComponent();

            // Assert
            const liveRegion = screen.getByRole('alertdialog');
            expect(liveRegion).toBeInTheDocument();
        });

        it('confirmation dialog has proper ARIA attributes', async () => {
            // Arrange
            mockAuth.user = { profile: { role: Role.Admin } };
            mockUseListReports.reportListData = [
                {
                    id: 1,
                    name: 'Test Report',
                    status: 'Approved',
                    date: '2024-01-15T00:00:00',
                    protocolName: 'Protocol 1',
                    auditorName: 'Auditor 1',
                    companyName: 'Company 1',
                },
            ];

            // Act
            renderComponent();
            const extractButton = screen.getByLabelText('Extract vulnerabilities from report using AI');
            fireEvent.click(extractButton);

            // Assert
            await waitFor(() => {
                const dialog = screen.getByRole('dialog');
                expect(dialog).toHaveAttribute('aria-labelledby', 'extract-confirm-title');
            });
        });
    });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { useListReports } from '../list-reports.hook';
import currentPageReducer from '../../../../admin-main-window/current-page-slice';
import currentErrorReducer from '../../../../admin-main-window/current-error-slice';
import * as api from '../../../../../../../api/soroban-security-portal/soroban-security-portal-api';

// Mock the API module
vi.mock('../../../../../../../api/soroban-security-portal/soroban-security-portal-api', () => ({
    getAllReportListDataCall: vi.fn(),
    removeReportCall: vi.fn(),
    approveReportCall: vi.fn(),
    rejectReportCall: vi.fn(),
    extractVulnerabilitiesFromReportCall: vi.fn(),
}));

// Create test store
const createTestStore = () => {
    return configureStore({
        reducer: {
            currentPage: currentPageReducer,
            currentError: currentErrorReducer,
        },
    });
};

// Create wrapper with Redux provider
const createWrapper = () => {
    const store = createTestStore();
    return ({ children }: { children: React.ReactNode }) => (
        <Provider store={store}>{children}</Provider>
    );
};

const mockCurrentPageState = {
    pageName: 'Reports',
    pageCode: 'reports',
    pageUrl: '/admin/reports',
    routePath: 'admin/reports',
};

const mockReports = [
    {
        id: 1,
        name: 'Test Report 1',
        status: 'Approved',
        date: '2024-01-15',
        protocolName: 'Protocol 1',
        auditorName: 'Auditor 1',
        companyName: 'Company 1',
    },
    {
        id: 2,
        name: 'Test Report 2',
        status: 'New',
        date: '2024-01-16',
        protocolName: 'Protocol 2',
        auditorName: 'Auditor 2',
        companyName: 'Company 2',
    },
];

describe('useListReports', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (api.getAllReportListDataCall as ReturnType<typeof vi.fn>).mockResolvedValue(mockReports);
        (api.removeReportCall as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
        (api.approveReportCall as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
        (api.rejectReportCall as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    });

    describe('extractVulnerabilities callback', () => {
        it('calls extractVulnerabilitiesFromReportCall with correct reportId', async () => {
            // Arrange
            const mockExtractionResult = {
                totalExtracted: 5,
                totalCreated: 4,
                duplicatesSkipped: 1,
                createdVulnerabilityIds: [100, 101, 102, 103],
                validationWarnings: [],
                processingErrors: [],
                processingTimeMs: 1500,
            };
            (api.extractVulnerabilitiesFromReportCall as ReturnType<typeof vi.fn>).mockResolvedValue(mockExtractionResult);

            const wrapper = createWrapper();
            const { result } = renderHook(
                () => useListReports({ currentPageState: mockCurrentPageState }),
                { wrapper }
            );

            // Wait for initial load
            await waitFor(() => {
                expect(result.current.reportListData).toBeDefined();
            });

            // Act
            await act(async () => {
                await result.current.extractVulnerabilities(42);
            });

            // Assert
            expect(api.extractVulnerabilitiesFromReportCall).toHaveBeenCalledWith(42);
        });

        it('sets extractionResult on successful extraction', async () => {
            // Arrange
            const mockExtractionResult = {
                totalExtracted: 3,
                totalCreated: 2,
                duplicatesSkipped: 1,
                createdVulnerabilityIds: [200, 201],
                validationWarnings: ['Warning 1'],
                processingErrors: [],
                processingTimeMs: 2000,
            };
            (api.extractVulnerabilitiesFromReportCall as ReturnType<typeof vi.fn>).mockResolvedValue(mockExtractionResult);

            const wrapper = createWrapper();
            const { result } = renderHook(
                () => useListReports({ currentPageState: mockCurrentPageState }),
                { wrapper }
            );

            await waitFor(() => {
                expect(result.current.reportListData).toBeDefined();
            });

            // Act
            await act(async () => {
                await result.current.extractVulnerabilities(1);
            });

            // Assert
            expect(result.current.extractionResult).toEqual(mockExtractionResult);
        });

        it('sets extractionError when extraction fails', async () => {
            // Arrange
            const errorMessage = 'Report not found';
            (api.extractVulnerabilitiesFromReportCall as ReturnType<typeof vi.fn>).mockRejectedValue(new Error(errorMessage));

            const wrapper = createWrapper();
            const { result } = renderHook(
                () => useListReports({ currentPageState: mockCurrentPageState }),
                { wrapper }
            );

            await waitFor(() => {
                expect(result.current.reportListData).toBeDefined();
            });

            // Act
            await act(async () => {
                await result.current.extractVulnerabilities(999);
            });

            // Assert
            expect(result.current.extractionError).toBe(errorMessage);
            expect(result.current.extractionResult).toBeNull();
        });

        it('handles non-Error rejection gracefully', async () => {
            // Arrange
            (api.extractVulnerabilitiesFromReportCall as ReturnType<typeof vi.fn>).mockRejectedValue('String error');

            const wrapper = createWrapper();
            const { result } = renderHook(
                () => useListReports({ currentPageState: mockCurrentPageState }),
                { wrapper }
            );

            await waitFor(() => {
                expect(result.current.reportListData).toBeDefined();
            });

            // Act
            await act(async () => {
                await result.current.extractVulnerabilities(1);
            });

            // Assert
            expect(result.current.extractionError).toBe('Extraction failed');
        });
    });

    describe('extraction state management', () => {
        it('sets extractingReportId while extraction is in progress', async () => {
            // Arrange
            let resolvePromise: (value: unknown) => void;
            const slowPromise = new Promise((resolve) => {
                resolvePromise = resolve;
            });
            (api.extractVulnerabilitiesFromReportCall as ReturnType<typeof vi.fn>).mockReturnValue(slowPromise);

            const wrapper = createWrapper();
            const { result } = renderHook(
                () => useListReports({ currentPageState: mockCurrentPageState }),
                { wrapper }
            );

            await waitFor(() => {
                expect(result.current.reportListData).toBeDefined();
            });

            // Act - start extraction
            act(() => {
                result.current.extractVulnerabilities(42);
            });

            // Assert - should be extracting
            expect(result.current.extractingReportId).toBe(42);

            // Complete the extraction
            await act(async () => {
                resolvePromise!({
                    totalExtracted: 1,
                    totalCreated: 1,
                    duplicatesSkipped: 0,
                    createdVulnerabilityIds: [1],
                    validationWarnings: [],
                    processingErrors: [],
                    processingTimeMs: 100,
                });
            });

            // Assert - should no longer be extracting
            expect(result.current.extractingReportId).toBeNull();
        });

        it('clears extractingReportId after extraction completes', async () => {
            // Arrange
            const mockResult = {
                totalExtracted: 2,
                totalCreated: 2,
                duplicatesSkipped: 0,
                createdVulnerabilityIds: [1, 2],
                validationWarnings: [],
                processingErrors: [],
                processingTimeMs: 500,
            };
            (api.extractVulnerabilitiesFromReportCall as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

            const wrapper = createWrapper();
            const { result } = renderHook(
                () => useListReports({ currentPageState: mockCurrentPageState }),
                { wrapper }
            );

            await waitFor(() => {
                expect(result.current.reportListData).toBeDefined();
            });

            // Act
            await act(async () => {
                await result.current.extractVulnerabilities(1);
            });

            // Assert
            expect(result.current.extractingReportId).toBeNull();
        });

        it('clears extractingReportId after extraction fails', async () => {
            // Arrange
            (api.extractVulnerabilitiesFromReportCall as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Failed'));

            const wrapper = createWrapper();
            const { result } = renderHook(
                () => useListReports({ currentPageState: mockCurrentPageState }),
                { wrapper }
            );

            await waitFor(() => {
                expect(result.current.reportListData).toBeDefined();
            });

            // Act
            await act(async () => {
                await result.current.extractVulnerabilities(1);
            });

            // Assert
            expect(result.current.extractingReportId).toBeNull();
        });

        it('clears previous error when starting new extraction', async () => {
            // Arrange
            (api.extractVulnerabilitiesFromReportCall as ReturnType<typeof vi.fn>)
                .mockRejectedValueOnce(new Error('First error'))
                .mockResolvedValueOnce({
                    totalExtracted: 1,
                    totalCreated: 1,
                    duplicatesSkipped: 0,
                    createdVulnerabilityIds: [1],
                    validationWarnings: [],
                    processingErrors: [],
                    processingTimeMs: 100,
                });

            const wrapper = createWrapper();
            const { result } = renderHook(
                () => useListReports({ currentPageState: mockCurrentPageState }),
                { wrapper }
            );

            await waitFor(() => {
                expect(result.current.reportListData).toBeDefined();
            });

            // First extraction - should fail
            await act(async () => {
                await result.current.extractVulnerabilities(1);
            });
            expect(result.current.extractionError).toBe('First error');

            // Second extraction - should clear error
            await act(async () => {
                await result.current.extractVulnerabilities(2);
            });
            expect(result.current.extractionError).toBeNull();
        });
    });

    describe('clearExtractionResult', () => {
        it('clears extractionResult when called', async () => {
            // Arrange
            const mockResult = {
                totalExtracted: 1,
                totalCreated: 1,
                duplicatesSkipped: 0,
                createdVulnerabilityIds: [1],
                validationWarnings: [],
                processingErrors: [],
                processingTimeMs: 100,
            };
            (api.extractVulnerabilitiesFromReportCall as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

            const wrapper = createWrapper();
            const { result } = renderHook(
                () => useListReports({ currentPageState: mockCurrentPageState }),
                { wrapper }
            );

            await waitFor(() => {
                expect(result.current.reportListData).toBeDefined();
            });

            // Extract first
            await act(async () => {
                await result.current.extractVulnerabilities(1);
            });
            expect(result.current.extractionResult).not.toBeNull();

            // Act - clear result
            act(() => {
                result.current.clearExtractionResult();
            });

            // Assert
            expect(result.current.extractionResult).toBeNull();
        });

        it('clears extractionError when called', async () => {
            // Arrange
            (api.extractVulnerabilitiesFromReportCall as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Error'));

            const wrapper = createWrapper();
            const { result } = renderHook(
                () => useListReports({ currentPageState: mockCurrentPageState }),
                { wrapper }
            );

            await waitFor(() => {
                expect(result.current.reportListData).toBeDefined();
            });

            // Extract first - should fail
            await act(async () => {
                await result.current.extractVulnerabilities(1);
            });
            expect(result.current.extractionError).not.toBeNull();

            // Act - clear error
            act(() => {
                result.current.clearExtractionResult();
            });

            // Assert
            expect(result.current.extractionError).toBeNull();
        });

        it('clears both result and error when called', async () => {
            // Arrange - first set an error
            (api.extractVulnerabilitiesFromReportCall as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Error'));

            const wrapper = createWrapper();
            const { result } = renderHook(
                () => useListReports({ currentPageState: mockCurrentPageState }),
                { wrapper }
            );

            await waitFor(() => {
                expect(result.current.reportListData).toBeDefined();
            });

            await act(async () => {
                await result.current.extractVulnerabilities(1);
            });

            // Act
            act(() => {
                result.current.clearExtractionResult();
            });

            // Assert
            expect(result.current.extractionResult).toBeNull();
            expect(result.current.extractionError).toBeNull();
        });
    });

    describe('hook initialization', () => {
        it('initializes with null extraction state', async () => {
            // Arrange
            const wrapper = createWrapper();
            const { result } = renderHook(
                () => useListReports({ currentPageState: mockCurrentPageState }),
                { wrapper }
            );

            // Assert initial state
            expect(result.current.extractingReportId).toBeNull();
            expect(result.current.extractionResult).toBeNull();
            expect(result.current.extractionError).toBeNull();
        });

        it('provides extractVulnerabilities function', async () => {
            // Arrange
            const wrapper = createWrapper();
            const { result } = renderHook(
                () => useListReports({ currentPageState: mockCurrentPageState }),
                { wrapper }
            );

            // Assert
            expect(result.current.extractVulnerabilities).toBeDefined();
            expect(typeof result.current.extractVulnerabilities).toBe('function');
        });

        it('provides clearExtractionResult function', async () => {
            // Arrange
            const wrapper = createWrapper();
            const { result } = renderHook(
                () => useListReports({ currentPageState: mockCurrentPageState }),
                { wrapper }
            );

            // Assert
            expect(result.current.clearExtractionResult).toBeDefined();
            expect(typeof result.current.clearExtractionResult).toBe('function');
        });
    });

    describe('extraction result data', () => {
        it('returns all fields from extraction result', async () => {
            // Arrange
            const mockResult = {
                totalExtracted: 10,
                totalCreated: 8,
                duplicatesSkipped: 2,
                createdVulnerabilityIds: [1, 2, 3, 4, 5, 6, 7, 8],
                validationWarnings: ['Warning 1', 'Warning 2'],
                processingErrors: ['Minor error'],
                processingTimeMs: 5000,
            };
            (api.extractVulnerabilitiesFromReportCall as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

            const wrapper = createWrapper();
            const { result } = renderHook(
                () => useListReports({ currentPageState: mockCurrentPageState }),
                { wrapper }
            );

            await waitFor(() => {
                expect(result.current.reportListData).toBeDefined();
            });

            // Act
            await act(async () => {
                await result.current.extractVulnerabilities(1);
            });

            // Assert
            expect(result.current.extractionResult).toEqual(mockResult);
            expect(result.current.extractionResult?.totalExtracted).toBe(10);
            expect(result.current.extractionResult?.totalCreated).toBe(8);
            expect(result.current.extractionResult?.duplicatesSkipped).toBe(2);
            expect(result.current.extractionResult?.createdVulnerabilityIds).toHaveLength(8);
            expect(result.current.extractionResult?.validationWarnings).toHaveLength(2);
            expect(result.current.extractionResult?.processingErrors).toHaveLength(1);
            expect(result.current.extractionResult?.processingTimeMs).toBe(5000);
        });

        it('handles empty extraction result', async () => {
            // Arrange
            const emptyResult = {
                totalExtracted: 0,
                totalCreated: 0,
                duplicatesSkipped: 0,
                createdVulnerabilityIds: [],
                validationWarnings: ['No vulnerabilities found'],
                processingErrors: [],
                processingTimeMs: 100,
            };
            (api.extractVulnerabilitiesFromReportCall as ReturnType<typeof vi.fn>).mockResolvedValue(emptyResult);

            const wrapper = createWrapper();
            const { result } = renderHook(
                () => useListReports({ currentPageState: mockCurrentPageState }),
                { wrapper }
            );

            await waitFor(() => {
                expect(result.current.reportListData).toBeDefined();
            });

            // Act
            await act(async () => {
                await result.current.extractVulnerabilities(1);
            });

            // Assert
            expect(result.current.extractionResult?.totalExtracted).toBe(0);
            expect(result.current.extractionResult?.totalCreated).toBe(0);
            expect(result.current.extractionResult?.validationWarnings).toContain('No vulnerabilities found');
        });
    });

    describe('interaction with other hook functionality', () => {
        it('does not interfere with report data loading', async () => {
            // Arrange
            const wrapper = createWrapper();
            const { result } = renderHook(
                () => useListReports({ currentPageState: mockCurrentPageState }),
                { wrapper }
            );

            // Wait for initial load
            await waitFor(() => {
                expect(result.current.reportListData).toEqual(mockReports);
            });

            // Assert
            expect(api.getAllReportListDataCall).toHaveBeenCalled();
        });

        it('does not trigger report list refresh after extraction', async () => {
            // Arrange
            const mockResult = {
                totalExtracted: 1,
                totalCreated: 1,
                duplicatesSkipped: 0,
                createdVulnerabilityIds: [1],
                validationWarnings: [],
                processingErrors: [],
                processingTimeMs: 100,
            };
            (api.extractVulnerabilitiesFromReportCall as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

            const wrapper = createWrapper();
            const { result } = renderHook(
                () => useListReports({ currentPageState: mockCurrentPageState }),
                { wrapper }
            );

            await waitFor(() => {
                expect(result.current.reportListData).toBeDefined();
            });

            // Clear mock call count after initial load
            vi.mocked(api.getAllReportListDataCall).mockClear();

            // Act
            await act(async () => {
                await result.current.extractVulnerabilities(1);
            });

            // Assert - should not refresh list (extraction doesn't change report data)
            expect(api.getAllReportListDataCall).not.toHaveBeenCalled();
        });
    });
});

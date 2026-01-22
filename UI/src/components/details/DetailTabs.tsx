import { ReactNode, useState, SyntheticEvent } from 'react';
import {
  Box,
  Tabs,
  Tab,
  useMediaQuery,
  useTheme,
  Badge,
} from '@mui/material';

/**
 * Configuration for a single tab
 */
export interface TabConfig {
  /** Unique identifier for the tab */
  id: string;
  /** Display label */
  label: string;
  /** Icon to display before the label */
  icon: ReactNode;
  /** Optional count to display as a badge */
  count?: number;
}

/**
 * Props for DetailTabs component (tab bar only)
 */
export interface DetailTabsProps {
  /** Tab configurations */
  tabs: TabConfig[];
  /** Current selected tab index (controlled mode) */
  value?: number;
  /** Tab change handler (controlled mode) */
  onChange?: (event: SyntheticEvent, newValue: number) => void;
  /** Default tab index for uncontrolled mode */
  defaultTab?: number;
}

/**
 * DetailTabs - A tab navigation component for detail pages.
 *
 * This component handles only the tab bar. Tab content is rendered
 * separately by the parent component based on the selected tab index.
 *
 * Supports both controlled and uncontrolled modes:
 * - Controlled: Pass `value` and `onChange` props
 * - Uncontrolled: Use `defaultTab` and let component manage state
 *
 * @example Controlled mode (recommended for pages with side effects):
 * ```tsx
 * const [tabValue, setTabValue] = useState(0);
 *
 * useEffect(() => {
 *   if (tabValue === 1) {
 *     fetchPdfContent();
 *   }
 * }, [tabValue]);
 *
 * <DetailTabs
 *   tabs={[
 *     { id: 'overview', label: 'Overview', icon: <Dashboard /> },
 *     { id: 'report', label: 'Full Report', icon: <Description /> }
 *   ]}
 *   value={tabValue}
 *   onChange={(_, newValue) => setTabValue(newValue)}
 * />
 *
 * {tabValue === 0 && <OverviewContent />}
 * {tabValue === 1 && <FullReportContent />}
 * ```
 *
 * @example Uncontrolled mode (simple pages):
 * ```tsx
 * <DetailTabs
 *   tabs={[
 *     { id: 'overview', label: 'Overview', icon: <Dashboard /> },
 *     { id: 'activity', label: 'Activity', icon: <TimelineIcon /> }
 *   ]}
 *   defaultTab={0}
 * />
 * ```
 */
export function DetailTabs({
  tabs,
  value: controlledValue,
  onChange: controlledOnChange,
  defaultTab = 0,
}: DetailTabsProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Internal state for uncontrolled mode
  const [internalValue, setInternalValue] = useState(defaultTab);

  // Determine if controlled or uncontrolled
  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : internalValue;

  const handleChange = (event: SyntheticEvent, newValue: number) => {
    if (isControlled && controlledOnChange) {
      controlledOnChange(event, newValue);
    } else {
      setInternalValue(newValue);
    }
  };

  return (
    <Box sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
      <Tabs
        value={value}
        onChange={handleChange}
        variant={isMobile ? 'fullWidth' : 'standard'}
        sx={{
          '& .MuiTab-root': {
            textTransform: 'none',
            fontSize: '1rem',
            fontWeight: 600,
            minHeight: 64,
          },
        }}
      >
        {tabs.map((tab) => (
          <Tab
            key={tab.id}
            icon={
              tab.count !== undefined ? (
                <Badge badgeContent={tab.count} color="primary" max={99}>
                  {tab.icon as React.ReactElement}
                </Badge>
              ) : (
                tab.icon as React.ReactElement
              )
            }
            iconPosition="start"
            label={tab.label}
          />
        ))}
      </Tabs>
    </Box>
  );
}

/**
 * Hook for managing detail tabs state.
 * Provides a simple way to get controlled tab props.
 *
 * @param defaultTab - Initial tab index
 * @returns Tab state and handler
 *
 * @example
 * ```tsx
 * const { tabValue, handleTabChange, tabProps } = useDetailTabs(0);
 *
 * <DetailTabs tabs={tabs} {...tabProps} />
 *
 * {tabValue === 0 && <OverviewContent />}
 * {tabValue === 1 && <ActivityContent />}
 * ```
 */
export function useDetailTabs(defaultTab = 0) {
  const [tabValue, setTabValue] = useState(defaultTab);

  const handleTabChange = (_event: SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return {
    tabValue,
    setTabValue,
    handleTabChange,
    tabProps: {
      value: tabValue,
      onChange: handleTabChange,
    },
  };
}

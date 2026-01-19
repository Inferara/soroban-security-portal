import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { Assessment, BugReport, Business } from '@mui/icons-material';
import { StatisticsCards, StatisticCard } from '../StatisticsCards';

const theme = createTheme();

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
);

describe('StatisticsCards', () => {
  const basicCards: StatisticCard[] = [
    {
      icon: <Assessment data-testid="icon-assessment" />,
      iconColor: '#B91C1C',
      value: 42,
      label: 'Reports',
    },
    {
      icon: <BugReport data-testid="icon-bug" />,
      iconColor: '#C2410C',
      value: 156,
      label: 'Vulnerabilities',
    },
    {
      icon: <Business data-testid="icon-business" />,
      iconColor: '#0369A1',
      value: 12,
      label: 'Protocols',
    },
  ];

  describe('rendering', () => {
    it('renders all statistic cards', () => {
      render(<StatisticsCards cards={basicCards} />, { wrapper });

      expect(screen.getByText('Reports')).toBeInTheDocument();
      expect(screen.getByText('Vulnerabilities')).toBeInTheDocument();
      expect(screen.getByText('Protocols')).toBeInTheDocument();
    });

    it('displays correct values', () => {
      render(<StatisticsCards cards={basicCards} />, { wrapper });

      expect(screen.getByText('42')).toBeInTheDocument();
      expect(screen.getByText('156')).toBeInTheDocument();
      expect(screen.getByText('12')).toBeInTheDocument();
    });

    it('renders icons', () => {
      render(<StatisticsCards cards={basicCards} />, { wrapper });

      expect(screen.getByTestId('icon-assessment')).toBeInTheDocument();
      expect(screen.getByTestId('icon-bug')).toBeInTheDocument();
      expect(screen.getByTestId('icon-business')).toBeInTheDocument();
    });

    it('handles string values', () => {
      const cardsWithStrings: StatisticCard[] = [
        {
          icon: <Assessment />,
          iconColor: '#B91C1C',
          value: '85%',
          label: 'Fix Rate',
        },
        {
          icon: <BugReport />,
          iconColor: '#C2410C',
          value: 'N/A',
          label: 'Unknown',
        },
      ];

      render(<StatisticsCards cards={cardsWithStrings} />, { wrapper });

      expect(screen.getByText('85%')).toBeInTheDocument();
      expect(screen.getByText('N/A')).toBeInTheDocument();
    });

    it('handles zero values', () => {
      const zeroCards: StatisticCard[] = [
        {
          icon: <Assessment />,
          iconColor: '#B91C1C',
          value: 0,
          label: 'No Reports',
        },
      ];

      render(<StatisticsCards cards={zeroCards} />, { wrapper });

      expect(screen.getByText('0')).toBeInTheDocument();
      expect(screen.getByText('No Reports')).toBeInTheDocument();
    });
  });

  describe('tooltips', () => {
    it('renders card without tooltip when not provided', () => {
      const cardsWithoutTooltip: StatisticCard[] = [
        {
          icon: <Assessment />,
          iconColor: '#B91C1C',
          value: 42,
          label: 'Reports',
        },
      ];

      render(<StatisticsCards cards={cardsWithoutTooltip} />, { wrapper });

      expect(screen.getByText('Reports')).toBeInTheDocument();
      expect(screen.getByText('42')).toBeInTheDocument();
    });

    it('renders card with tooltip when provided', () => {
      const cardsWithTooltip: StatisticCard[] = [
        {
          icon: <Assessment />,
          iconColor: '#B91C1C',
          value: '85%',
          label: 'Fix Rate',
          tooltip: 'Percentage of vulnerabilities that have been fixed',
        },
      ];

      render(<StatisticsCards cards={cardsWithTooltip} />, { wrapper });

      expect(screen.getByText('Fix Rate')).toBeInTheDocument();
      expect(screen.getByText('85%')).toBeInTheDocument();
    });
  });

  describe('column configuration', () => {
    it('uses default columns when not specified', () => {
      const { container } = render(<StatisticsCards cards={basicCards} />, { wrapper });

      const gridContainer = container.querySelector('.MuiBox-root');
      expect(gridContainer).toBeInTheDocument();
    });

    it('accepts custom column configuration', () => {
      const { container } = render(
        <StatisticsCards
          cards={basicCards}
          columns={{ xs: 1, sm: 2, md: 3, lg: 4 }}
        />,
        { wrapper }
      );

      const gridContainer = container.querySelector('.MuiBox-root');
      expect(gridContainer).toBeInTheDocument();
    });

    it('accepts partial column configuration', () => {
      const { container } = render(
        <StatisticsCards
          cards={basicCards}
          columns={{ xs: 1, md: 2 }}
        />,
        { wrapper }
      );

      const gridContainer = container.querySelector('.MuiBox-root');
      expect(gridContainer).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('renders nothing when cards array is empty', () => {
      const { container } = render(<StatisticsCards cards={[]} />, { wrapper });

      const gridContainer = container.querySelector('.MuiBox-root');
      expect(gridContainer).toBeInTheDocument();
      expect(gridContainer?.children.length).toBe(0);
    });
  });

  describe('single card', () => {
    it('renders correctly with a single card', () => {
      const singleCard: StatisticCard[] = [
        {
          icon: <Assessment data-testid="single-icon" />,
          iconColor: '#B91C1C',
          value: 1,
          label: 'Single Item',
        },
      ];

      render(<StatisticsCards cards={singleCard} />, { wrapper });

      expect(screen.getByTestId('single-icon')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('Single Item')).toBeInTheDocument();
    });
  });

  describe('many cards', () => {
    it('renders correctly with many cards', () => {
      const manyCards: StatisticCard[] = Array.from({ length: 8 }, (_, i) => ({
        icon: <Assessment data-testid={`icon-${i}`} />,
        iconColor: '#B91C1C',
        value: i * 10,
        label: `Card ${i + 1}`,
      }));

      render(<StatisticsCards cards={manyCards} />, { wrapper });

      for (let i = 0; i < 8; i++) {
        expect(screen.getByTestId(`icon-${i}`)).toBeInTheDocument();
        expect(screen.getByText(`Card ${i + 1}`)).toBeInTheDocument();
      }
    });
  });

  describe('accessibility', () => {
    it('renders semantic card elements', () => {
      render(<StatisticsCards cards={basicCards} />, { wrapper });

      // MUI Cards should be present
      const cards = document.querySelectorAll('.MuiCard-root');
      expect(cards.length).toBe(3);
    });

    it('includes typography for labels', () => {
      render(<StatisticsCards cards={basicCards} />, { wrapper });

      // Check that labels are rendered as typography
      expect(screen.getByText('Reports')).toBeInTheDocument();
      expect(screen.getByText('Vulnerabilities')).toBeInTheDocument();
    });
  });
});

import { Box, Card, CardActionArea, Typography } from '@mui/material';
import {
  getCategoryImage,
  VulnerabilityCategory,
} from '../../api/soroban-security-portal/models/vulnerability';
import type { PieChartDataPoint } from './SeverityPieChart';

export interface CategoryFilterPanesProps {
  data: PieChartDataPoint[];
  selectedCategoryId: number | null;
  onCategorySelect: (categoryId: number | null) => void;
}

/**
 * Clickable category summary panes used to filter vulnerability lists on detail pages.
 */
export function CategoryFilterPanes({
  data,
  selectedCategoryId,
  onCategorySelect,
}: CategoryFilterPanesProps) {
  if (data.length === 0) {
    return null;
  }

  const handleClick = (categoryId: number) => {
    onCategorySelect(selectedCategoryId === categoryId ? null : categoryId);
  };

  return (
    <Box
      role="group"
      aria-label="Filter vulnerabilities by category"
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 1.5,
      }}
    >
      {data.map((item) => {
        const categoryId = Number(item.id);
        const selected = selectedCategoryId === categoryId;
        return (
          <Card
            key={item.id}
            variant="outlined"
            sx={{
              flex: { xs: '1 1 calc(50% - 12px)', md: '1 1 auto' },
              minWidth: { md: 150 },
              borderColor: selected ? item.color : 'divider',
              borderWidth: selected ? 2 : 1,
              boxShadow: selected ? 2 : 0,
            }}
          >
            <CardActionArea
              onClick={() => handleClick(categoryId)}
              aria-pressed={selected}
              sx={{ p: 1.5, height: '100%' }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box
                  component="img"
                  src={getCategoryImage(categoryId as VulnerabilityCategory)}
                  alt=""
                  width={28}
                  height={28}
                />
                <Box sx={{ minWidth: 0, textAlign: 'left' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    {item.label}
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                    {item.value}
                  </Typography>
                </Box>
              </Box>
            </CardActionArea>
          </Card>
        );
      })}
    </Box>
  );
}

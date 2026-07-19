import { FC } from 'react';
import { Box, Chip } from '@mui/material';
import { VulnerabilityCategoryInfo } from '../../api/soroban-security-portal/models/vulnerability';

interface Props {
  categories: VulnerabilityCategoryInfo[];
  selected: number | null;
  onSelect: (id: number | null) => void;
}

export const CategoryPane: FC<Props> = ({ categories, selected, onSelect }) => (
  <Box sx={{ mb: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
    <Chip
      label="All"
      clickable
      color={selected === null ? 'primary' : 'default'}
      onClick={() => onSelect(null)}
    />
    {categories.map((cat) => (
      <Chip
        key={cat.id}
        label={cat.label}
        clickable
        color={selected === cat.id ? 'primary' : 'default'}
        onClick={() => onSelect(cat.id)}
      />
    ))}
  </Box>
);

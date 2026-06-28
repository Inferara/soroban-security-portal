import { FC } from 'react';
import { Box, Card, CardActionArea, Chip, Typography } from '@mui/material';
import ScienceIcon from '@mui/icons-material/Science';
import { FixtureInfo } from '../../../../api/dev-tools/dev-tools-api';

interface SamplesGridProps {
  fixtures: FixtureInfo[];
  selected: string;
  disabled?: boolean;
  onPick: (name: string) => void;
}

/** Discoverable card grid of built-in sample contracts (replaces a dropdown). */
export const SamplesGrid: FC<SamplesGridProps> = ({ fixtures, selected, disabled, onPick }) => {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: '1fr 1fr 1fr' },
        gap: 1.5,
      }}
    >
      {fixtures.map((f) => (
        <Card
          key={f.name}
          variant="outlined"
          sx={{
            borderColor: f.name === selected ? 'primary.main' : 'divider',
            borderWidth: f.name === selected ? 2 : 1,
          }}
        >
          <CardActionArea
            disabled={disabled}
            onClick={() => onPick(f.name)}
            sx={{ p: 1.5, height: '100%', display: 'block' }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <ScienceIcon fontSize="small" color="primary" />
              <Typography sx={{ fontWeight: 700, fontFamily: 'monospace' }}>{f.name}</Typography>
              <Box sx={{ flexGrow: 1 }} />
              <Chip size="small" variant="outlined" label={`${f.size.toLocaleString()} B`} />
            </Box>
            <Typography variant="body2" color="text.secondary">
              {f.description}
            </Typography>
          </CardActionArea>
        </Card>
      ))}
    </Box>
  );
};

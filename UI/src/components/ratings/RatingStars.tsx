import { FC } from 'react';
import { Rating, RatingProps, styled } from '@mui/material';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import StarBorderRoundedIcon from '@mui/icons-material/StarBorderRounded';

/**
 * A warm-gold star control used everywhere ratings are shown.
 * Wraps MUI's Rating so display and input share one look:
 * filled stars glow gold, hovering an interactive star nudges it up.
 */
const StyledRating = styled(Rating, {
  shouldForwardProp: (prop) => prop !== 'glow',
})<{ glow?: boolean }>(({ glow }) => ({
  '& .MuiRating-iconFilled': {
    color: '#f5b50a',
    filter: glow ? 'drop-shadow(0 0 4px rgba(245,181,10,0.45))' : 'none',
  },
  '& .MuiRating-iconHover': {
    color: '#ffc933',
    transform: 'scale(1.2)',
  },
  '& .MuiRating-iconEmpty': {
    color: 'rgba(245,181,10,0.32)',
  },
  '& .MuiRating-icon': {
    transition: 'transform 120ms ease, color 120ms ease',
  },
}));

export interface RatingStarsProps extends Omit<RatingProps, 'icon' | 'emptyIcon'> {
  /** Add a soft glow behind filled stars (nice for the big summary score). */
  glow?: boolean;
}

export const RatingStars: FC<RatingStarsProps> = ({ glow, ...props }) => (
  <StyledRating
    glow={glow}
    icon={<StarRoundedIcon fontSize="inherit" />}
    emptyIcon={<StarBorderRoundedIcon fontSize="inherit" />}
    {...props}
  />
);

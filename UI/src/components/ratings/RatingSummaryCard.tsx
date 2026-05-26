import { FC } from 'react';
import { Box, Card, CardContent, Chip, LinearProgress, Stack, Tooltip, Typography, useTheme } from '@mui/material';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import { RatingStars } from './RatingStars';
import { RatingSummary } from '../../api/soroban-security-portal/models/rating';

interface RatingSummaryCardProps {
  summary: RatingSummary | null;
}

const STARS = [5, 4, 3, 2, 1];

/**
 * The hero of the Reviews tab: a large average score with a gold glow, the
 * reputation-weighted average alongside it, and a 5→1 distribution with
 * animated bars. Falls back to an inviting empty state when nothing is rated.
 */
export const RatingSummaryCard: FC<RatingSummaryCardProps> = ({ summary }) => {
  const theme = useTheme();
  const total = summary?.totalReviews ?? 0;
  const average = summary?.averageScore ?? 0;
  const weighted = summary?.weightedAverageScore ?? 0;

  return (
    <Card
      sx={{
        overflow: 'hidden',
        position: 'relative',
        background: `linear-gradient(135deg, ${theme.palette.background.paper} 0%, rgba(245,181,10,0.06) 100%)`,
      }}
    >
      <CardContent>
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            gap: { xs: 3, sm: 4 },
            alignItems: { xs: 'stretch', sm: 'center' },
          }}
        >
          {/* Score block */}
          <Box
            sx={{
              textAlign: 'center',
              minWidth: 160,
              px: 2,
              borderRight: { sm: `1px solid ${theme.palette.divider}` },
            }}
          >
            <Typography
              component="div"
              sx={{
                fontSize: '3.5rem',
                fontWeight: 800,
                lineHeight: 1,
                background: 'linear-gradient(135deg, #f5b50a 0%, #ff8a00 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              {total > 0 ? average.toFixed(1) : '—'}
            </Typography>
            <Box sx={{ mt: 1 }}>
              <RatingStars value={average} precision={0.1} readOnly glow size="medium" />
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {total === 0 ? 'No ratings yet' : `${total} ${total === 1 ? 'rating' : 'ratings'}`}
            </Typography>
            {total > 0 && (
              <Tooltip title="Average weighted by each reviewer's reputation">
                <Chip
                  icon={<AutoAwesomeRoundedIcon sx={{ fontSize: 16 }} />}
                  label={`Weighted ${weighted.toFixed(1)}`}
                  size="small"
                  variant="outlined"
                  sx={{ mt: 1.5, borderColor: 'rgba(245,181,10,0.5)' }}
                />
              </Tooltip>
            )}
          </Box>

          {/* Distribution block */}
          <Box sx={{ flex: 1, width: '100%' }}>
            {total === 0 ? (
              <Stack spacing={1} sx={{ alignItems: 'center', justifyContent: 'center', height: '100%', py: 2 }}>
                <StarRoundedIcon sx={{ fontSize: 40, color: 'rgba(245,181,10,0.5)' }} />
                <Typography color="text.secondary" align="center">
                  Be the first to share how secure and trustworthy this is.
                </Typography>
              </Stack>
            ) : (
              <Stack spacing={1}>
                {STARS.map((star) => {
                  const count = summary?.distribution?.[String(star)] ?? 0;
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                  return (
                    <Box key={star} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, width: 34, flexShrink: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{star}</Typography>
                        <StarRoundedIcon sx={{ fontSize: 14, color: '#f5b50a' }} />
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={pct}
                        aria-label={`${star} star`}
                        sx={{
                          flex: 1,
                          height: 8,
                          borderRadius: 5,
                          backgroundColor: 'rgba(245,181,10,0.12)',
                          '& .MuiLinearProgress-bar': {
                            borderRadius: 5,
                            background: 'linear-gradient(90deg, #f5b50a 0%, #ff8a00 100%)',
                            transition: 'transform 600ms cubic-bezier(0.4,0,0.2,1)',
                          },
                        }}
                      />
                      <Typography variant="body2" color="text.secondary" sx={{ width: 36, textAlign: 'right', flexShrink: 0 }}>
                        {count}
                      </Typography>
                    </Box>
                  );
                })}
              </Stack>
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

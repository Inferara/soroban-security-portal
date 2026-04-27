import { Box, Typography, LinearProgress, Tooltip } from '@mui/material';
import { StarRating, StarRatingSize } from './StarRating';

export interface RatingSummaryProps {
    /** Average rating (0–5) */
    average: number;
    /** Total number of ratings */
    count: number;
    /**
     * Distribution of ratings by star value.
     * Keys are 1–5, values are counts.
     */
    distribution?: Partial<Record<1 | 2 | 3 | 4 | 5, number>>;
    size?: StarRatingSize;
    /** Show the per-star distribution bars */
    showDistribution?: boolean;
}

export function RatingSummary({
    average,
    count,
    distribution,
    size = 'medium',
    showDistribution = true,
}: RatingSummaryProps) {
    const rounded = Math.round(average * 10) / 10;
    const maxCount = distribution
        ? Math.max(...(Object.values(distribution) as number[]), 1)
        : 1;

    return (
        <Box sx={{ display: 'inline-flex', flexDirection: 'column', gap: 1 }}>
            {/* Average + stars row */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography
                    variant="h4"
                    component="span"
                    sx={{ fontWeight: 700, lineHeight: 1 }}
                    aria-hidden="true"
                >
                    {rounded.toFixed(1)}
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                    <StarRating value={average} readOnly size={size} label="Average rating" />
                    <Typography variant="caption" color="text.secondary">
                        {count.toLocaleString()} {count === 1 ? 'rating' : 'ratings'}
                    </Typography>
                </Box>
            </Box>

            {/* Distribution bars */}
            {showDistribution && distribution && (
                <Box
                    role="list"
                    aria-label="Rating distribution"
                    sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, minWidth: 180 }}
                >
                    {([5, 4, 3, 2, 1] as const).map((star) => {
                        const starCount = distribution[star] ?? 0;
                        const pct = count > 0 ? Math.round((starCount / count) * 100) : 0;
                        return (
                            <Tooltip
                                key={star}
                                title={`${starCount} ${starCount === 1 ? 'rating' : 'ratings'} (${pct}%)`}
                                arrow
                                placement="right"
                            >
                                <Box
                                    role="listitem"
                                    aria-label={`${star} star: ${starCount} ratings`}
                                    sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                                >
                                    <Typography variant="caption" sx={{ minWidth: 8 }}>
                                        {star}
                                    </Typography>
                                    <LinearProgress
                                        variant="determinate"
                                        value={(starCount / maxCount) * 100}
                                        sx={{
                                            flex: 1,
                                            height: 8,
                                            borderRadius: 4,
                                            backgroundColor: 'action.hover',
                                            '& .MuiLinearProgress-bar': {
                                                backgroundColor: 'warning.main',
                                                borderRadius: 4,
                                            },
                                        }}
                                    />
                                    <Typography variant="caption" color="text.secondary" sx={{ minWidth: 28, textAlign: 'right' }}>
                                        {pct}%
                                    </Typography>
                                </Box>
                            </Tooltip>
                        );
                    })}
                </Box>
            )}
        </Box>
    );
}

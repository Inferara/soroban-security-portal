import { FC } from 'react';
import {
    Box,
    Typography,
    Rating,
    Card,
    CardContent,
    Divider,
    List,
    ListItem,
    ListItemText,
    Button,
    Stack,
    LinearProgress,
} from '@mui/material';
import { Star, RateReview } from '@mui/icons-material';
import { AuditorRating } from '../../../../../api/soroban-security-portal/models/auditor';
import { formatDateLong } from '../../../../../utils';

interface AuditorRatingSectionProps {
    ratings: AuditorRating[];
    averageRating: number;
    onAddRating: () => void;
    canRate: boolean;
}

export const AuditorRatingSection: FC<AuditorRatingSectionProps> = ({
    ratings,
    averageRating,
    onAddRating,
    canRate,
}) => {
    const ratingCount = ratings.length;

    // Calculate distributions
    const distribution = [0, 0, 0, 0, 0];
    ratings.forEach((r: AuditorRating) => {
        const score = Math.round(r.averageScore);
        if (score >= 1 && score <= 5) {
            distribution[score - 1]++;
        }
    });

    return (
        <Card sx={{ mb: 3 }}>
            <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        <Star sx={{ mr: 1, verticalAlign: 'middle', color: 'warning.main' }} />
                        Auditor Ratings
                    </Typography>
                    {canRate && (
                        <Button
                            variant="outlined"
                            startIcon={<RateReview />}
                            onClick={onAddRating}
                        >
                            Rate Auditor
                        </Button>
                    )}
                </Box>

                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 4, mb: 4 }}>
                    {/* Summary */}
                    <Box sx={{ textAlign: 'center', minWidth: 150 }}>
                        <Typography variant="h2" sx={{ fontWeight: 700, color: 'text.primary' }}>
                            {averageRating.toFixed(1)}
                        </Typography>
                        <Rating value={averageRating} precision={0.5} readOnly size="large" />
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            {ratingCount} {ratingCount === 1 ? 'rating' : 'ratings'}
                        </Typography>
                    </Box>

                    {/* Distribution */}
                    <Box sx={{ flexGrow: 1 }}>
                        {[5, 4, 3, 2, 1].map((score) => (
                            <Box key={score} sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                                <Typography variant="body2" sx={{ minWidth: 20, mr: 1 }}>
                                    {score}
                                </Typography>
                                <Star sx={{ fontSize: 16, mr: 1, color: 'warning.main' }} />
                                <Box sx={{ flexGrow: 1, mr: 2 }}>
                                    <LinearProgress
                                        variant="determinate"
                                        value={ratingCount > 0 ? (distribution[score - 1] / ratingCount) * 100 : 0}
                                        sx={{ height: 8, borderRadius: 4 }}
                                    />
                                </Box>
                                <Typography variant="body2" color="text.secondary" sx={{ minWidth: 30 }}>
                                    {distribution[score - 1]}
                                </Typography>
                            </Box>
                        ))}
                    </Box>
                </Box>

                <Divider sx={{ my: 3 }} />

                {/* Individual Ratings */}
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                    Recent Reviews
                </Typography>

                {ratings.length > 0 ? (
                    <List disablePadding>
                        {ratings.map((rating, index) => (
                            <Box key={rating.id}>
                                <ListItem alignItems="flex-start" sx={{ px: 0, py: 2 }}>
                                    <ListItemText
                                        primary={
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                                <Rating value={rating.averageScore} precision={0.1} readOnly size="small" />
                                                <Typography variant="caption" color="text.secondary">
                                                    {formatDateLong(new Date(rating.createdAt))}
                                                </Typography>
                                            </Box>
                                        }
                                        secondary={
                                            <>
                                                <Typography
                                                    variant="body2"
                                                    color="text.primary"
                                                    sx={{ mb: 1, fontWeight: 500 }}
                                                >
                                                    {rating.comment || 'No comment provided.'}
                                                </Typography>
                                                <Stack direction="row" spacing={2}>
                                                    <Typography variant="caption" color="text.secondary">
                                                        Quality: {rating.qualityScore}/5
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        Communication: {rating.communicationScore}/5
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        Thoroughness: {rating.thoroughnessScore}/5
                                                    </Typography>
                                                </Stack>
                                            </>
                                        }
                                    />
                                </ListItem>
                                {index < ratings.length - 1 && <Divider component="li" />}
                            </Box>
                        ))}
                    </List>
                ) : (
                    <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                        No reviews yet. Be the first to rate this auditor!
                    </Typography>
                )}
            </CardContent>
        </Card>
    );
};

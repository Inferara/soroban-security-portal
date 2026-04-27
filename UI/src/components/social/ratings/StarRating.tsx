import { useState } from 'react';
import { Box, Tooltip } from '@mui/material';
import StarIcon from '@mui/icons-material/Star';
import StarHalfIcon from '@mui/icons-material/StarHalf';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import { AccentColors, Transitions } from '../../../theme/constants';

export type StarRatingSize = 'small' | 'medium' | 'large';

export interface StarRatingProps {
    /** Current value (0–5, supports 0.5 increments for display) */
    value: number;
    /** Called with new integer value when user selects a star (interactive mode) */
    onChange?: (value: number) => void;
    /** When true, renders as read-only display (supports half-stars) */
    readOnly?: boolean;
    size?: StarRatingSize;
    /** Total number of stars */
    max?: number;
    /** Accessible label prefix, e.g. "Audit report rating" */
    label?: string;
}

const sizeMap: Record<StarRatingSize, { fontSize: string; gap: number }> = {
    small: { fontSize: '16px', gap: 0.25 },
    medium: { fontSize: '24px', gap: 0.5 },
    large: { fontSize: '32px', gap: 0.75 },
};

const starColor = AccentColors.navigationActive; // gold

function StarDisplay({ filled }: { filled: 'full' | 'half' | 'empty' }) {
    const sx = { color: filled !== 'empty' ? starColor : 'action.disabled', fontSize: 'inherit' };
    if (filled === 'full') return <StarIcon sx={sx} />;
    if (filled === 'half') return <StarHalfIcon sx={sx} />;
    return <StarBorderIcon sx={sx} />;
}

export function StarRating({
    value,
    onChange,
    readOnly = false,
    size = 'medium',
    max = 5,
    label = 'Rating',
}: StarRatingProps) {
    const [hovered, setHovered] = useState<number | null>(null);
    const { fontSize, gap } = sizeMap[size];
    const interactive = !readOnly && !!onChange;
    const displayValue = interactive && hovered !== null ? hovered : value;

    function getStarType(index: number): 'full' | 'half' | 'empty' {
        const starNumber = index + 1;
        if (displayValue >= starNumber) return 'full';
        if (!interactive && displayValue >= starNumber - 0.5) return 'half';
        return 'empty';
    }

    return (
        <Box
            role="group"
            aria-label={`${label}: ${value} out of ${max} stars`}
            sx={{ display: 'inline-flex', alignItems: 'center', gap, fontSize }}
        >
            {Array.from({ length: max }, (_, i) => {
                const starValue = i + 1;
                const filled = getStarType(i);
                const starEl = (
                    <Box
                        key={i}
                        component={interactive ? 'button' : 'span'}
                        aria-label={interactive ? `${starValue} star${starValue !== 1 ? 's' : ''}` : undefined}
                        onClick={interactive ? () => onChange(starValue) : undefined}
                        onMouseEnter={interactive ? () => setHovered(starValue) : undefined}
                        onMouseLeave={interactive ? () => setHovered(null) : undefined}
                        sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            cursor: interactive ? 'pointer' : 'default',
                            transition: `transform ${Transitions.fast}`,
                            '&:hover': interactive
                                ? { transform: 'scale(1.2)' }
                                : undefined,
                            '&:focus-visible': {
                                outline: `2px solid ${starColor}`,
                                outlineOffset: '2px',
                                borderRadius: '2px',
                            },
                        }}
                    >
                        <StarDisplay filled={filled} />
                    </Box>
                );

                return interactive ? (
                    <Tooltip key={i} title={`${starValue} star${starValue !== 1 ? 's' : ''}`} arrow>
                        {starEl}
                    </Tooltip>
                ) : (
                    starEl
                );
            })}
        </Box>
    );
}
